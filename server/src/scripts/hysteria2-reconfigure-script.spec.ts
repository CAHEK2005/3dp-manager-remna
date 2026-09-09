import { ScriptsService, type Script } from './scripts.service';
import {
  HYSTERIA2_RECONFIGURE_SCRIPT,
  HYSTERIA2_RECONFIGURE_SCRIPT_ID,
  HYSTERIA2_SCRIPT_ID,
} from './hysteria2-script';

describe('Hysteria2 domain reconfiguration built-in', () => {
  function shellFunction(script: string, name: string): string {
    const marker = `${name}() {`;
    const start = script.indexOf(marker);
    if (start < 0) return '';

    const bodyStart = start + marker.length;
    const nextFunction = script
      .slice(bodyStart)
      .search(/\n[A-Za-z_][A-Za-z0-9_]*\(\) \{/);
    return nextFunction < 0
      ? script.slice(start)
      : script.slice(start, bodyStart + nextFunction);
  }

  function createService(initial: Record<string, string> = {}) {
    const rows = new Map(Object.entries(initial));
    const repo = {
      findOne: jest.fn(({ where: { key } }: { where: { key: string } }) => {
        const value = rows.get(key);
        return Promise.resolve(value === undefined ? null : { key, value });
      }),
      save: jest.fn(({ key, value }: { key: string; value: string }) => {
        rows.set(key, value);
        return Promise.resolve({ key, value });
      }),
      create: jest.fn((value: { key: string }) => value),
    };
    const service = new ScriptsService(
      repo as never,
      { notifyScriptExecution: jest.fn() } as never,
      {
        getValue: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      } as never,
    );
    return { repo, service };
  }

  async function seedReconfigureScript(service: ScriptsService) {
    await service.onModuleInit();
    const script = (await service.getScripts()).find(
      (item) => item.id === HYSTERIA2_RECONFIGURE_SCRIPT_ID,
    );
    if (!script)
      throw new Error('Hysteria2 reconfigure built-in was not seeded');
    return script;
  }

  function render(
    service: ScriptsService,
    script: Script,
    variables: Record<string, string>,
  ): string {
    return (
      service as unknown as {
        renderScript(target: Script, input: Record<string, string>): string;
      }
    ).renderScript(script, variables);
  }

  it('seeds a separate idempotent domain-change built-in', async () => {
    const { repo, service } = createService();

    const script = await seedReconfigureScript(service);
    const firstSaveCount = repo.save.mock.calls.length;
    await service.onModuleInit();
    const scripts = await service.getScripts();

    expect(script).toMatchObject({
      id: HYSTERIA2_RECONFIGURE_SCRIPT_ID,
      name: 'Смена домена Hysteria2',
      isBuiltIn: true,
    });
    expect(HYSTERIA2_RECONFIGURE_SCRIPT_ID).not.toBe(HYSTERIA2_SCRIPT_ID);
    expect(
      scripts.filter((item) => item.id === HYSTERIA2_RECONFIGURE_SCRIPT_ID),
    ).toHaveLength(1);
    expect(repo.save).toHaveBeenCalledTimes(firstSaveCount);
  });

  it('requests only the new domain and ACME email', async () => {
    const { service } = createService();
    const script = await seedReconfigureScript(service);
    const variableRegex = /\{\{\s*(\w+)(?:\s*\|\s*([^}]*?))?\s*\}\}/g;
    const variables = [...script.content.matchAll(variableRegex)].map(
      (match) => match[1],
    );

    expect(variables).toEqual(['hysteria_new_domain', 'certbot_email']);
    expect(script.content).toBe(HYSTERIA2_RECONFIGURE_SCRIPT);
    expect(script.content).toContain('/opt/certbot/hysteria2.env');
    expect(script.content).not.toContain('{{ hysteria_domain');

    const rendered = render(service, script, {
      hysteria_new_domain: 'new-vpn.example.com',
      certbot_email: 'admin+acme@example.com',
    });
    expect(rendered).toContain(
      'REQUESTED_HYSTERIA_DOMAIN="new-vpn.example.com"',
    );
    expect(rendered).toContain('HYSTERIA_DOMAIN="$REQUESTED_HYSTERIA_DOMAIN"');
    expect(rendered).toContain('CERTBOT_EMAIL="admin+acme@example.com"');
    expect(rendered).not.toContain('{{ hysteria_new_domain');
    expect(rendered).not.toContain('{{ certbot_email');
  });

  it('applies strict Hysteria2 validation to the new built-in id', async () => {
    const { service } = createService();
    const script = await seedReconfigureScript(service);

    expect(() =>
      render(service, script, {
        hysteria_new_domain: 'vpn.example.com$(id)',
        certbot_email: 'admin@example.com',
      }),
    ).toThrow('Некорректный новый домен Hysteria2');
    expect(() =>
      render(service, script, {
        hysteria_new_domain: 'VPN.example.com',
        certbot_email: 'admin@example.com',
      }),
    ).toThrow('Некорректный новый домен Hysteria2');
    expect(() =>
      render(service, script, {
        hysteria_new_domain: 'vpn.example.com',
        certbot_email: 'admin@example.com\n$(id)',
      }),
    ).toThrow("Некорректный email для Let's Encrypt");
  });

  it('retains the setup transaction and certificate safety invariants', () => {
    const script = HYSTERIA2_RECONFIGURE_SCRIPT;
    const setupLock = script.indexOf('if ! mkdir "$SETUP_LOCK_DIR"');
    const renewalLock = script.indexOf(
      'exec 9>/run/lock/rwm-hysteria2.lock',
      setupLock,
    );
    const certificateRequest = script.indexOf(
      'run_certbot_bounded 10m',
      renewalLock,
    );
    const certificateSanCheck = script.indexOf(
      '-checkhost "$HYSTERIA_DOMAIN"',
      certificateRequest,
    );
    const publishCertificate = script.indexOf(
      'RESTART_REMNANODE=0 HYSTERIA_ENV_FILE="$STAGE_DIR/hysteria2.env"',
      certificateRequest,
    );
    const publishRuntimeConfiguration = script.indexOf(
      'publish_runtime_configuration',
      certificateSanCheck,
    );
    const commit = script.indexOf('TRANSACTION_ACTIVE=0', certificateRequest);

    expect(script).toContain('set -Eeuo pipefail');
    expect(script).toContain('[ -f "$managed_file" ]');
    expect(script).toContain('stat -c \'%u\' "$managed_file"');
    expect(script).toContain(
      'sed -n \'s/^HYSTERIA_DOMAIN=//p\' "$MANAGED_ENV"',
    );
    expect(script).toContain(
      '[ "$REQUESTED_HYSTERIA_DOMAIN" = "$CURRENT_HYSTERIA_DOMAIN" ]',
    );
    expect(script).toContain('flock -n 9');
    expect(script).toContain('--cert-name "$HYSTERIA_DOMAIN"');
    expect(script).toContain('--no-random-sleep-on-renew');
    expect(script).toContain('timeout --foreground --kill-after=30s 5m');
    expect(script).toContain('run --rm -T certbot');
    expect(script).toContain('</dev/null');
    expect(script).toContain('openssl x509');
    expect(script).toContain('openssl pkey');
    expect(script).toContain('rollback_transaction');
    expect(script).toContain('docker compose up -d --force-recreate remnanode');
    expect(script).toContain('test -r /etc/hysteria2/fullchain.pem');
    expect(script).toContain('test -r /etc/hysteria2/privkey.pem');
    expect(script).not.toContain('certbot delete');

    expect(setupLock).toBeGreaterThanOrEqual(0);
    expect(renewalLock).toBeGreaterThan(setupLock);
    expect(certificateRequest).toBeGreaterThan(renewalLock);
    expect(certificateSanCheck).toBeGreaterThan(certificateRequest);
    expect(publishCertificate).toBeGreaterThan(certificateRequest);
    expect(publishCertificate).toBeGreaterThan(certificateSanCheck);
    expect(publishRuntimeConfiguration).toBeGreaterThan(certificateSanCheck);
    expect(publishCertificate).toBeGreaterThan(publishRuntimeConfiguration);
    expect(commit).toBeGreaterThan(publishCertificate);
  });

  it('bounds every mutating Certbot operation and reports hard timeouts', () => {
    const script = HYSTERIA2_RECONFIGURE_SCRIPT;
    const boundedHelper = shellFunction(script, 'run_certbot_bounded');
    const helperDefinition = script.indexOf('run_certbot_bounded() {');
    const callsStart = helperDefinition + boundedHelper.length;
    const certonly = script.indexOf('\n  certonly', callsStart);
    const reconfigure = script.indexOf('\n    reconfigure', certonly + 1);

    expect(boundedHelper).toContain('timeout --foreground');
    expect(boundedHelper).toContain('"$timeout_value"');
    expect(boundedHelper).toContain('124|137');
    expect(boundedHelper).toMatch(/case\s+"?\$[A-Za-z_]+"?\s+in/);
    expect(script).toMatch(/run_certbot_bounded 10m[^\n]*\\\n\s+certonly/);
    expect(script).toMatch(/run_certbot_bounded 10m[^\n]*\\\n\s+reconfigure/);
    expect(script).not.toContain('run --rm -T certbot certonly');
    expect(script).not.toContain('run --rm -T certbot reconfigure');

    expect(certonly).toBeGreaterThan(helperDefinition);
    expect(script.lastIndexOf('run_certbot_bounded', certonly)).toBeGreaterThan(
      helperDefinition,
    );
    expect(reconfigure).toBeGreaterThan(certonly);
    expect(
      script.lastIndexOf('run_certbot_bounded', reconfigure),
    ).toBeGreaterThan(script.lastIndexOf('run_certbot_bounded', certonly));
  });

  it('reuses a lineage only when its managed marker and exact SAN are valid', () => {
    const script = HYSTERIA2_RECONFIGURE_SCRIPT;
    const exactSanCheck = shellFunction(
      script,
      'certificate_has_exact_dns_san',
    );
    const markerCheck = shellFunction(script, 'lineage_marker_is_valid_for');
    const markerReservation = shellFunction(
      script,
      'reserve_lineage_marker_for',
    );
    const reuseMessage = script.indexOf(
      'Найден совместимый Certbot lineage нового домена',
    );

    expect(script).toContain(
      'LINEAGE_MARKER_DIR="/opt/certbot/rwm-hysteria2-lineages"',
    );
    expect(exactSanCheck).toContain('subjectAltName');
    expect(exactSanCheck).toContain('DNS:');
    expect(exactSanCheck).toContain('sort -u');
    expect(exactSanCheck).toContain('[ "$san_domains" = "$expected_domain" ]');
    expect(markerCheck).toContain('LINEAGE_MARKER_DIR');
    expect(markerCheck).toContain("stat -c '%u'");
    expect(markerReservation).toContain('LINEAGE_MARKER_DIR');
    expect(markerReservation).toMatch(/install|mv\s+-T/);

    expect(reuseMessage).toBeGreaterThanOrEqual(0);
    expect(
      script.lastIndexOf('lineage_marker_is_valid_for', reuseMessage),
    ).toBeGreaterThan(script.indexOf('lineage_marker_is_valid_for() {'));
    expect(
      script.lastIndexOf('certificate_has_exact_dns_san', reuseMessage),
    ).toBeGreaterThan(script.indexOf('certificate_has_exact_dns_san() {'));
    expect(script).toContain('reserve_lineage_marker');
    expect(script).toContain('HYSTERIA_REQUIRE_MANAGED_LINEAGE=1');
  });

  it('re-verifies the live read-only mount and certificate after recreate', () => {
    const script = HYSTERIA2_RECONFIGURE_SCRIPT;
    const verifier = shellFunction(
      script,
      'verify_remnanode_certificate_mount',
    );
    const certificateRequest = script.indexOf('run_certbot_bounded 10m');
    const mainRecreate = script.indexOf(
      'docker compose up -d --force-recreate remnanode',
      certificateRequest,
    );
    const mainVerification = script.indexOf(
      'verify_remnanode_certificate_mount_with_retry',
      mainRecreate,
    );
    const commit = script.indexOf('TRANSACTION_ACTIVE=0', mainVerification);

    expect(verifier).toContain('docker inspect');
    expect(verifier).toContain('timeout --foreground --kill-after=5s 20s');
    expect(verifier).toContain('.RW == false');
    expect(verifier).toContain('sha256sum');
    expect(verifier).toContain('openssl x509');
    expect(verifier).toContain('checkhost');
    expect(mainRecreate).toBeGreaterThanOrEqual(0);
    expect(mainVerification).toBeGreaterThan(mainRecreate);
    expect(commit).toBeGreaterThan(mainVerification);
  });

  it('accounts for rollback failures and verifies the restored cert and mount', () => {
    const script = HYSTERIA2_RECONFIGURE_SCRIPT;
    const rollback = shellFunction(script, 'rollback_transaction');
    const onExit = shellFunction(script, 'on_exit');

    expect(rollback).toContain('ROLLBACK_FAILED=0');
    expect(rollback).toContain('ROLLBACK_FAILED=1');
    expect(rollback).toContain('verify_remnanode_certificate_mount');
    expect(rollback).toContain('ROLLBACK_CERT_HASH');
    expect(rollback).toContain('ROLLBACK_KEY_HASH');
    expect(rollback).toContain('checkhost "$ROLLBACK_HYSTERIA_DOMAIN"');
    expect(rollback).toContain('[ "$ROLLBACK_FAILED" -ne 0 ]');
    expect(rollback).toContain('return 1');
    expect(rollback).toContain(
      '[ROLLBACK] Предыдущая конфигурация подтверждена',
    );
    expect(onExit).toContain('rollback_transaction');
    expect(onExit).toContain('rollback_transaction || EXIT_CODE=1');
  });

  it('publishes crash-recoverable runtime state before switching current', () => {
    const script = HYSTERIA2_RECONFIGURE_SCRIPT;
    const atomicInstall = shellFunction(script, 'atomic_install');
    const publishRuntime = shellFunction(
      script,
      'publish_runtime_configuration',
    );
    const certificateRequest = script.indexOf('run_certbot_bounded 10m');
    const publishRuntimeCall = script.indexOf(
      'publish_runtime_configuration',
      certificateRequest,
    );
    const publishCurrent = script.indexOf(
      'RESTART_REMNANODE=0 HYSTERIA_ENV_FILE="$STAGE_DIR/hysteria2.env"',
      publishRuntimeCall,
    );

    expect(script).toContain('HYSTERIA_RECONFIGURE_MODE=1');
    expect(script).toContain(
      'HYSTERIA_PREVIOUS_DOMAIN_FOR_RECOVERY="$ACTIVE_CERT_DOMAIN"',
    );
    expect(script).toContain('HYSTERIA_PREVIOUS_DOMAIN=');
    expect(script).toContain('Обнаружено незавершённое переключение');
    expect(script).toContain(
      'ROLLBACK_HYSTERIA_DOMAIN="$HYSTERIA_PREVIOUS_DOMAIN_FOR_RECOVERY"',
    );
    expect(atomicInstall).toContain('mv -Tf "$install_tmp" "$target_path"');
    expect(atomicInstall).toContain('sync -f "$target_path"');
    expect(publishRuntime.lastIndexOf('$CERTBOT_ENV')).toBeGreaterThan(
      publishRuntime.lastIndexOf('$CRON_FILE'),
    );
    expect(publishRuntimeCall).toBeGreaterThan(certificateRequest);
    expect(publishCurrent).toBeGreaterThan(publishRuntimeCall);
  });
});
