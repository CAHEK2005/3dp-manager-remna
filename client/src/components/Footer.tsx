import { Box, Container } from '@mui/material';

interface FooterProps {
  isMobile?: boolean;
}

export default function Footer({ isMobile: _isMobile }: FooterProps) {
  return (
    <Box
      component="footer"
      sx={{
        py: 3,
        px: 2,
        mt: 'auto',
        backgroundColor: (theme) =>
          theme.palette.mode === 'light'
            ? theme.palette.grey[200]
            : theme.palette.grey[900],
      }}
    >
      <Container maxWidth={false} />
    </Box>
  );
}
