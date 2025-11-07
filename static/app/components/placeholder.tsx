import styled from '@emotion/styled';

export interface PlaceholderProps extends React.HTMLAttributes<HTMLDivElement> {
  // error?: React.ReactNode;
  height?: string;
  shape?: 'rect' | 'circle';
  width?: string;
}

const Placeholder = styled(({className, children, style}: PlaceholderProps) => {
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
})<PlaceholderProps>`
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  background-color: ${p => p.theme.backgroundTertiary};
  width: ${p => p.width ?? '100%'};
  height: ${p => p.height ?? '60px'};
  border-radius: ${p => (p.shape === 'circle' ? '100%' : p.theme.borderRadius)};
`;

export default Placeholder;
