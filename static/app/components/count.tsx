import {formatAbbreviatedNumber} from 'app/utils/formatters';

type Props = {
  value: string | number;
  className?: string;
};

function Count(props: Props) {
  const {value, className} = props;

  return (
    <span className={className} title={value.toLocaleString()}>
      {formatAbbreviatedNumber(value)}
    </span>
  );
}

export default Count;
