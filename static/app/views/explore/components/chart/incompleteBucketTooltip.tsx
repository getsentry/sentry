import {useMemo} from 'react';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import {escape} from 'sentry/utils';
import {defined} from 'sentry/utils/defined';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {ChartInfo} from 'sentry/views/explore/components/chart/types';

type SeriesDetailsRenderer = (seriesNames: string[], timestamp: number) => string;

const NOTE_STYLE = [
  'width: 200px',
  'min-width: 100%',
  'white-space: normal',
  'text-align: center',
  'margin: 0 auto',
].join('; ');

function renderNote(theme: Theme, delayLine: string, waitLine?: string): string {
  const dividerStyle = [
    `border-top: solid 1px ${theme.tokens.border.secondary}`,
    `margin: ${theme.space.md} calc(-1 * ${theme.space.xl}) 0`,
    `padding: ${theme.space.md} ${theme.space.xl} 0`,
  ].join('; ');
  const delayStyle = `color: ${theme.tokens.content.primary}`;

  const wait = waitLine ? `<div fontSize="xs">${escape(waitLine)}</div>` : '';
  return `<div style="${dividerStyle}"><div style="${NOTE_STYLE}"><div style="${delayStyle}">${escape(delayLine)}</div>${wait}</div></div>`;
}

export function useIncompleteBucketTooltipDetails(
  chartInfo: ChartInfo
): SeriesDetailsRenderer | undefined {
  const theme = useTheme();
  const organization = useOrganization();
  const hasFeature = organization.features.includes('measured-ingestion-delay-ui');
  const {completeThrough, estimatedIngestionDelaySeconds} =
    chartInfo.timeseriesResult.meta ?? {};

  return useMemo<SeriesDetailsRenderer | undefined>(() => {
    if (!hasFeature || !defined(completeThrough)) {
      return;
    }

    const delayLine = defined(estimatedIngestionDelaySeconds)
      ? t(
          'Event ingestion for this bucket is incomplete and currently takes ~%s.',
          getDuration(estimatedIngestionDelaySeconds)
        )
      : t('Event ingestion for this bucket is incomplete.');

    const notes = new Map<number, string>();
    for (const {meta, values} of chartInfo.series) {
      for (const {timestamp, incomplete} of values) {
        if (!incomplete || notes.has(timestamp)) {
          continue;
        }
        const secondsRemaining = (timestamp + meta.interval - completeThrough) / 1000;
        const waitLine =
          secondsRemaining >= 1
            ? t('Check again in ~%s.', getDuration(secondsRemaining))
            : undefined;
        notes.set(timestamp, renderNote(theme, delayLine, waitLine));
      }
    }

    return notes.size > 0 ? (_, timestamp) => notes.get(timestamp) ?? '' : undefined;
  }, [
    chartInfo.series,
    completeThrough,
    estimatedIngestionDelaySeconds,
    hasFeature,
    theme,
  ]);
}
