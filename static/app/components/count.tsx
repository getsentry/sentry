import {formatAbbreviatedNumber} from 'sentry/utils/formatters';

type Props = {
  value: string | number;
  className?: string;
};

function getTitle(value: string | number | undefined): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  // Counts from the API are often strings. Coerce to a number before calling
  // toLocaleString so string values never rely on String/Object.prototype
  // (which may be patched by extensions to Number.prototype.toLocaleString).
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString() : String(value);
}

export function Count({value, className}: Props) {
  return (
    <span className={className} title={getTitle(value)}>
      {formatAbbreviatedNumber(value)}
    </span>
  );
}
