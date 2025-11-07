import styled from '@emotion/styled';

export interface PlaceholderProps extends React.HTMLAttributes<HTMLDivElement> {
  error?: React.ReactNode;
  height?: string;
  shape?: 'rect' | 'circle';
  width?: string;
}

const Placeholder = styled(({className, children, error, style}: PlaceholderProps) => {
  return (
    <div className={className} style={style}>
      {error || children}
    </div>
  );
})<PlaceholderProps>`
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  color: ${p => (p.error ? p.theme.red200 : undefined)};
  background-color: ${p => (p.error ? p.theme.red100 : p.theme.backgroundTertiary)};
  width: ${p => p.width ?? '100%'};
  height: ${p => p.height ?? '60px'};
  border-radius: ${p => (p.shape === 'circle' ? '100%' : p.theme.borderRadius)};
`;

export default Placeholder;
