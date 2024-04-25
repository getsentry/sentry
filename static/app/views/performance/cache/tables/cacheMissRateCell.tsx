import {NumberContainer} from 'sentry/utils/discover/styles';
import {formatPercentage} from 'sentry/utils/formatters';

// TODO - delete this once we have `cache_miss_rate`, rely on field renderer to see the value as a percentage and render correctly
function CacheMissCell(props: {value: number}) {
  const {value} = props;
  const percentage = formatPercentage(value);
  return <NumberContainer>{percentage}</NumberContainer>;
}

export default CacheMissCell;
