import {formatAbbreviatedNumber} from 'sentry/utils/formatters';

export interface CountProps {
  value: string | number;
  className?: string;
}

function Count({value, className}: CountProps): React.ReactElement {
  return (
    <span className={className} title={value?.toLocaleString()}>
      {formatAbbreviatedNumber(value)}
    </span>
  );
}

export default Count;
