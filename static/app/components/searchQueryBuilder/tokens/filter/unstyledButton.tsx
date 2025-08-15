import styled from '@emotion/styled';

export function UnstyledButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <RemovedStylesButton type="button" {...props}>
      {children}
    </RemovedStylesButton>
  );
}

const RemovedStylesButton = styled('button')`
  background: none;
  border: none;
  outline: none;
  padding: 0;
  user-select: none;

  :focus {
    outline: none;
  }
`;
