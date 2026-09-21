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
  'overflow-wrap: break-word',
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
  const waitStyle = [
    `font-size: ${theme.font.size.xs}`,
    `margin-top: ${theme.space.xs}`,
  ].join('; ');

  const body = [
    `<div style="${delayStyle}">${escape(delayLine)}</div>`,
    waitLine ? `<div style="${waitStyle}">${escape(waitLine)}</div>` : '',
  ].join('');

  return `<div style="${dividerStyle}"><div style="${NOTE_STYLE}">${body}</div></div>`;
}

export function useIncompleteBucketTooltipDetails(
  chartInfo: ChartInfo
): SeriesDetailsRenderer | undefined {
  const theme = useTheme();
  const organization = useOrganization();
  const hasMeasuredIngestionDelayUi = organization.features.includes(
    'measured-ingestion-delay-ui'
  );
  const {completeThrough, estimatedIngestionDelaySeconds} =
    chartInfo.timeseriesResult.meta ?? {};

  return useMemo<SeriesDetailsRenderer | undefined>(() => {
    if (!hasMeasuredIngestionDelayUi || !defined(completeThrough)) {
      return;
    }

    const delayLine = defined(estimatedIngestionDelaySeconds)
      ? t(
          'Event ingestion for this bucket is incomplete and currently takes ~%s.',
          getDuration(estimatedIngestionDelaySeconds)
        )
      : t('Event ingestion for this bucket is incomplete.');

    const notes = new Map<number, string>();

    for (const series of chartInfo.series) {
      for (const value of series.values) {
        if (!value.incomplete || notes.has(value.timestamp)) {
          continue;
        }

        const secondsRemaining =
          (value.timestamp + series.meta.interval - completeThrough) / 1000;

        notes.set(
          value.timestamp,
          renderNote(
            theme,
            delayLine,
            secondsRemaining >= 1
              ? t('Check again in ~%s.', getDuration(secondsRemaining))
              : undefined
          )
        );
      }
    }

    if (notes.size === 0) {
      return;
    }

    return (_seriesNames, timestamp) => notes.get(timestamp) ?? '';
  }, [
    chartInfo.series,
    completeThrough,
    estimatedIngestionDelaySeconds,
    hasMeasuredIngestionDelayUi,
    theme,
  ]);
}
