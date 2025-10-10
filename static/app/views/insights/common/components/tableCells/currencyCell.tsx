import {NumberContainer} from 'sentry/utils/discover/styles';
import {formatDollars} from 'sentry/utils/formatters';

type Props = {
  value: number;
};

export function CurrencyCell({value}: Props) {
  return <NumberContainer>{formatDollars(value)}</NumberContainer>;
}
