import {NumberContainer} from 'sentry/utils/discover/styles';
import {formatPercentage} from 'sentry/utils/formatters';

function CacheMissCell(props: {value: number}) {
  const {value} = props;
  const percentage = formatPercentage(value);
  return <NumberContainer>{percentage}</NumberContainer>;
}

export default CacheMissCell;
