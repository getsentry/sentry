type NumberCellProps = {
  number: number;
  className?: string;
};

export function NumberCell({number, className}: NumberCellProps) {
  return <div className={className}>{number}</div>;
}
