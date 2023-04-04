import {formatAbbreviatedNumber} from 'sentry/utils/formatters';

type Props = {
  value: string | number;
  className?: string;
};

const Count = ({value, className}: Props) => {
  return (
    <span className={className} title={value?.toLocaleString()}>
      {formatAbbreviatedNumber(value)}
    </span>
  );
};

export default Count;
