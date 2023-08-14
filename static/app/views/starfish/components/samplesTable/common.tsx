import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {getDuration} from 'sentry/utils/formatters';
import {TextAlignRight} from 'sentry/views/starfish/components/textAlign';

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

  if (isNearAverage(duration, compareToDuration)) {
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

export const isNearAverage = (duration: number, compareToDuration: number) => {
  const maxDiff = 0.03 * compareToDuration;
  const diff = Math.abs(duration - compareToDuration);
  return diff < maxDiff;
};

const ComparisonLabel = styled('span')<{value: number}>`
  color: ${p =>
    p.value === 0 ? p.theme.subText : p.value < 0 ? p.theme.green400 : p.theme.red400};
  text-align: right;
`;
