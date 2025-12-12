import {formatAbbreviatedNumber} from 'sentry/utils/formatters';

const MAX_INT = 2147483647;

type Props = {
  value: string | number;
  className?: string;
  /**
   * When enabled, displays a "+" suffix if the value equals MAX_INT (2,147,483,647),
   * indicating the count may have exceeded the maximum trackable value.
   */
  showCappedIndicator?: boolean;
};

function Count({value, className, showCappedIndicator}: Props) {
  const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
  const isCapped = showCappedIndicator && numValue === MAX_INT;

  return (
    <span className={className} title={value?.toLocaleString()}>
      {formatAbbreviatedNumber(value)}
      {isCapped ? '+' : ''}
    </span>
  );
}

export default Count;
