import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {TextAlignRight} from 'sentry/views/insights/common/components/textAlign';

export function NumberCell({value}: {value: number}) {
  return <TextAlignRight>{formatAbbreviatedNumber(value)}</TextAlignRight>;
}
