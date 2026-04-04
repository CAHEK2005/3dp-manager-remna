import { useCallback, useState } from 'react';

interface AlertState {
  open: boolean;
  type: 'success' | 'error';
  text: string;
}

export function useAlert() {
  const [msg, setMsg] = useState<AlertState>({ open: false, type: 'success', text: '' });

  const showMsg = useCallback((type: 'success' | 'error', text: string) => {
    setMsg({ open: true, type, text });
  }, []);

  const closeMsg = useCallback(() => {
    setMsg(m => ({ ...m, open: false }));
  }, []);

  return { msg, showMsg, closeMsg };
}
