export function EmptyCell({className}: {className?: string}) {
  return (
    <div className={className} style={{alignSelf: 'center'}}>
      &mdash;
    </div>
  );
}
