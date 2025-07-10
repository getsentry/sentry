import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export function NotifPreview({
  title,
  children,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <Box>
      <PreviewTitle>{title}</PreviewTitle>
      {children}
    </Box>
  );
}

const PreviewTitle = styled('h2')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: bold;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;

const Box = styled('div')`
  padding: ${space(2)};
  background: ${p => p.theme.background};
`;
