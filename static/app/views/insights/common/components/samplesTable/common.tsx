import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import getDuration from 'sentry/utils/duration/getDuration';
import {areNumbersAlmostEqual} from 'sentry/utils/number/areNumbersAlmostEqual';
import {TextAlignRight} from 'sentry/views/insights/common/components/textAlign';
import {NEAR_AVERAGE_THRESHOLD_PERCENTAGE} from 'sentry/views/insights/settings';

type Props = {
  compareToDuration: number;
  duration: number;
  containerProps?: React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLSpanElement>,
    HTMLSpanElement
  >;
};

export function DurationComparisonCell({
  duration,
  compareToDuration,
  containerProps,
}: Props) {
  const diff = duration - compareToDuration;

  if (
    areNumbersAlmostEqual(duration, compareToDuration, NEAR_AVERAGE_THRESHOLD_PERCENTAGE)
  ) {
    return <TextAlignRight {...containerProps}>{t('Near Average')}</TextAlignRight>;
  }

  const readableDiff = getDuration(diff / 1000, 2, true, true);
  const labelString = diff > 0 ? `+${readableDiff} above` : `${readableDiff} below`;

  return (
    <ComparisonLabel {...containerProps} value={diff}>
      {labelString}
    </ComparisonLabel>
  );
}

const ComparisonLabel = styled('span')<{value: number}>`
  color: ${p =>
    p.value === 0 ? p.theme.subText : p.value < 0 ? p.theme.green400 : p.theme.red400};
  text-align: right;
`;
