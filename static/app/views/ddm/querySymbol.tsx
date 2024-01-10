import styled from '@emotion/styled';

const indexToChar = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const getQuerySymbol = (index: number) => {
  let result = '';
  let i = index;
  do {
    result = indexToChar[i % indexToChar.length] + result;
    i = Math.floor(i / indexToChar.length);
  } while (i > 0);
  return result;
};

const Symbol = styled('div')`
  display: flex;
  width: 16px;
  height: 16px;
  padding: 4px;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
  color: ${p => p.theme.black};
  font-size: 9px;
  font-weight: 500;
  background: ${p => p.theme.yellow300};
  border-radius: 50%;
`;

export function QuerySymbol({
  index,
  ...props
}: React.ComponentProps<typeof Symbol> & {index: number}) {
  return (
    <Symbol {...props}>
      <span>{getQuerySymbol(index)}</span>
    </Symbol>
  );
}
