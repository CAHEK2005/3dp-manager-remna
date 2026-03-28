import React, { useEffect, useState } from 'react';
import {
  Box, TextField, Button, Typography, Paper, Snackbar, Alert,
  Stack, Divider, Tabs, Tab, useTheme, useMediaQuery,
} from '@mui/material';
import api from '../api';

interface TabPanelProps { children?: React.ReactNode; index: number; value: number; }
function TabPanel({ children, value, index }: TabPanelProps) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;
}

export default function SettingsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [tab, setTab] = useState(0);

  // Connection tab state
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');

  // System tab state
  const [adminLogin, setAdminLogin] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [msg, setMsg] = useState({ open: false, type: 'success' as 'success' | 'error', text: '' });

  const showMsg = (type: 'success' | 'error', text: string) => setMsg({ open: true, type, text });

  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      if (data.remnawave_url) setUrl(data.remnawave_url);
      if (data.remnawave_api_key) setApiKey(data.remnawave_api_key);
      if (data.admin_login) setAdminLogin(data.admin_login);
    }).catch(console.error);
  }, []);

  const handleSaveConnection = async () => {
    const cleanedUrl = url.replace(/\/+$/, '').trim();
    const cleanedKey = apiKey.trim();
    try {
      await api.post('/settings', { remnawave_url: cleanedUrl, remnawave_api_key: cleanedKey });
      setUrl(cleanedUrl);
      setApiKey(cleanedKey);
      showMsg('success', 'Настройки подключения сохранены!');
    } catch {
      showMsg('error', 'Ошибка сохранения');
    }
  };

  const handleCheckConnection = async () => {
    const cleanedUrl = url.replace(/\/+$/, '').trim();
    const cleanedKey = apiKey.trim();
    try {
      showMsg('success', 'Проверка...');
      const res = await api.post('/settings/check', { remnawave_url: cleanedUrl, remnawave_api_key: cleanedKey });
      if (res.data.success) {
        showMsg('success', 'Подключение успешно!');
      } else {
        showMsg('error', 'Ошибка: неверные данные или нет доступа');
      }
    } catch {
      showMsg('error', 'Ошибка сети при проверке');
    }
  };

  const handleSaveAdmin = async () => {
    try {
      await api.post('/auth/update-profile', { login: adminLogin, password: adminPassword });
      showMsg('success', 'Профиль администратора обновлён!');
      setAdminPassword('');
    } catch {
      showMsg('error', 'Ошибка обновления профиля');
    }
  };

  return (
    <Box>
      <Typography variant={isMobile ? 'h5' : 'h4'} gutterBottom>Настройки</Typography>

      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Подключение" />
          <Tab label="Система" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Tab 0: Connection */}
          <TabPanel value={tab} index={0}>
            <Typography variant="h6" gutterBottom>Подключение к Remnawave</Typography>
            <Divider sx={{ mb: 2 }} />
            <TextField
              fullWidth margin="normal" label="URL панели Remnawave"
              value={url} onChange={e => setUrl(e.target.value)}
              helperText="Например: https://panel.example.com"
            />
            <TextField
              fullWidth margin="normal" label="API ключ (Bearer token)" type="password"
              value={apiKey} onChange={e => setApiKey(e.target.value)}
            />
            <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
              <Button variant="contained" onClick={handleSaveConnection}>Сохранить</Button>
              {url && apiKey && (
                <Button variant="outlined" color="info" onClick={handleCheckConnection}>Проверить</Button>
              )}
            </Stack>
          </TabPanel>

          {/* Tab 1: System */}
          <TabPanel value={tab} index={1}>
            <Typography variant="h6" gutterBottom>Доступ к RWManager</Typography>
            <Divider sx={{ mb: 2 }} />
            <TextField
              fullWidth margin="normal" label="Логин администратора"
              value={adminLogin} onChange={e => setAdminLogin(e.target.value)}
            />
            <TextField
              fullWidth margin="normal" label="Новый пароль" type="password"
              value={adminPassword} onChange={e => setAdminPassword(e.target.value)}
              helperText="Оставьте пустым, если не хотите менять"
            />
            <Button variant="contained" color="warning" sx={{ mt: 2 }} onClick={handleSaveAdmin}>
              Обновить профиль
            </Button>
          </TabPanel>
        </Box>
      </Paper>

      <Snackbar open={msg.open} autoHideDuration={5000} onClose={() => setMsg(m => ({ ...m, open: false }))}>
        <Alert severity={msg.type}>{msg.text}</Alert>
      </Snackbar>
    </Box>
  );
}
