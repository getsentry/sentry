import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export function PreviewBox({
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
`;

const Box = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(2)};
  background: ${p => p.theme.background};
`;
