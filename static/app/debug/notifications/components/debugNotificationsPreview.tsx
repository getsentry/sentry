import styled from '@emotion/styled';

export function DebugNotificationsPreview({
  title,
  children,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div>
      <PreviewTitle>{title}</PreviewTitle>
      {children}
    </div>
  );
}

const PreviewTitle = styled('h2')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: bold;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;
