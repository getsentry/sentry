import Count from 'sentry/components/count';
import {TextAlignRight} from 'sentry/views/insights/common/components/textAlign';

export function NumberCell({value}: {value: number}) {
  return (
    <TextAlignRight>
      <Count value={value} />
    </TextAlignRight>
  );
}
