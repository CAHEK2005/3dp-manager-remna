import { AxiosError } from 'axios';

export function getErrorMessage(e: unknown): string {
  if (e instanceof AxiosError) {
    const msg = e.response?.data?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    return msg || e.message;
  }
  if (e instanceof Error) return e.message;
  return 'Неизвестная ошибка';
}
