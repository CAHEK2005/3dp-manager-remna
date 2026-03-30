import React, { useEffect, useRef, useState } from 'react';
import { Box, TextField, Button, Typography, List, ListItem, ListItemText, IconButton, Paper, TablePagination, useTheme, useMediaQuery } from '@mui/material';
import { Delete, Add, UploadFile, Remove, Language } from '@mui/icons-material';
import api from '../api';
import UrlImportDialog from '../components/UrlImportDialog';

interface Domain { id: number; name: string; }

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [urlImportOpen, setUrlImportOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const loadDomains = async () => {
    try {
      const { data } = await api.get(`/domains?page=${page + 1}&limit=${rowsPerPage}`);

      setDomains(data.data);
      setTotalCount(data.total);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadDomains();
  }, [page, rowsPerPage]);

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleAdd = async () => {
    if (!newDomain) return;
    await api.post('/domains', { name: newDomain });
    setNewDomain('');
    loadDomains();
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/domains/${id}`);
    loadDomains();
  };

  const handleDeleteAll = async () => {
    if (confirm('ВНИМАНИЕ! Вы действительно хотите удалить ВСЕ домены из белого списка?')) {
      try {
        await api.delete('/domains/all');
        loadDomains();
      } catch (_e) { alert('Ошибка удаления'); }
    }
  };

  const handleUrlImport = async (importedDomains: string[]) => {
    try {
      const { data } = await api.post('/domains/upload', { domains: importedDomains });
      alert(`Успешно добавлено доменов: ${data.count}`);
      loadDomains();
    } catch (_err) {
      alert('Ошибка при загрузке списка');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/);

      try {
        const { data } = await api.post('/domains/upload', { domains: lines });
        alert(`Успешно добавлено доменов: ${data.count}`);
        loadDomains();
      } catch (_err) {
        alert('Ошибка при загрузке списка');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <Box>
      <Typography variant={isMobile ? 'h5' : 'h4'} gutterBottom>Белый список доменов (SNI)</Typography>

      <Paper sx={{ p: 2, display: 'flex', gap: 2 }}>
        <TextField
          label="Доменное имя" size="small" fullWidth
          value={newDomain} onChange={(e) => setNewDomain(e.target.value)}
        />
        {isMobile ? (
          <>
            <IconButton edge="end" onClick={() => fileInputRef.current?.click()}><UploadFile /></IconButton>
            <IconButton edge="end" onClick={() => setUrlImportOpen(true)}><Language /></IconButton>
            <IconButton edge="end" onClick={handleAdd}><Add /></IconButton>
          </>
        ) : (
          <>
            <Button
              variant="outlined"
              startIcon={<UploadFile />}
              sx={{ whiteSpace: 'nowrap' }}
              onClick={() => fileInputRef.current?.click()}
            >
              Из файла
            </Button>
            <Button
              variant="outlined"
              startIcon={<Language />}
              sx={{ whiteSpace: 'nowrap' }}
              onClick={() => setUrlImportOpen(true)}
            >
              Из URL
            </Button>
            <Button variant="contained" sx={{ width: '160px' }} startIcon={<Add />} onClick={handleAdd}>Добавить</Button>
          </>
        )}
        <input
          type="file"
          accept=".txt"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />
      </Paper>

      {domains.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'end', width: '100%' }}>
          <Button
            variant="text"
            color="error"
            size='small'
            startIcon={<Remove />}
            onClick={handleDeleteAll}
          >
            Удалить все
          </Button>
        </Box>
      )}

      <UrlImportDialog
        open={urlImportOpen}
        onClose={() => setUrlImportOpen(false)}
        onAdd={handleUrlImport}
      />

      <Paper sx={{ mt: domains.length > 0 ? 0 : 3 }}>
        <List>
          {domains.map((d) => (
            <ListItem key={d.id} secondaryAction={
              <IconButton edge="end" onClick={() => handleDelete(d.id)}><Delete /></IconButton>
            }>
              <ListItemText primary={d.name} />
            </ListItem>
          ))}
          {domains.length === 0 && <Typography sx={{ p: 2 }} color='textSecondary' textAlign='center'>Нет доменов</Typography>}
        </List>
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelRowsPerPage="Доменов на странице:"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} из ${count !== -1 ? count : `более ${to}`}`}
        />
      </Paper>
    </Box>
  );
}