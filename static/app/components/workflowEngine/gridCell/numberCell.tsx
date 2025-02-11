type NumberCellProps = {
  number: number;
};

export function NumberCell({number}: NumberCellProps) {
  return <div>{number}</div>;
}
