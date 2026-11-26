import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {MiniBarChart} from 'sentry/components/charts/miniBarChart';
import {Placeholder} from 'sentry/components/placeholder';
import {getRelativeSummary} from 'sentry/components/timeRangeSelector/utils';
import {t, tct, tn} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {CLASSIFIER_LIST_STATS_PERIOD} from 'sentry/views/classifiers/constants';
import type {
  ClassifierListStats,
  ClassifierListStatsResult,
} from 'sentry/views/classifiers/hooks/useClassifierListStats';

const SPARKLINE_HEIGHT = 20;
const SPARKLINE_TOOLTIP = {appendToBody: true};

interface ClassifierActivityProps {
  labelSizer: string;
  result: ClassifierListStatsResult;
}

function getSummary(stats: ClassifierListStats) {
  const period = getRelativeSummary(CLASSIFIER_LIST_STATS_PERIOD);
  const classifications = tn('classification', 'classifications', stats.classified);
  if (!stats.hasMatches) {
    return tct('[period]: [classified] [classifications]', {
      period,
      classified: stats.classified.toLocaleString(),
      classifications,
    });
  }
  return tct('[period]: [matches] of [classified] [classifications] matched ([rate])', {
    period,
    matches: stats.matches.toLocaleString(),
    classified: stats.classified.toLocaleString(),
    classifications,
    rate: formatPercentage(stats.classified ? stats.matches / stats.classified : 0, 1),
  });
}

function getActivityLabel(stats: ClassifierListStats) {
  return stats.hasMatches
    ? `${formatAbbreviatedNumber(stats.matches)}/${formatAbbreviatedNumber(stats.classified)}`
    : t('%s classified', formatAbbreviatedNumber(stats.classified));
}

export function getActivityLabelSizer(stats: Array<ClassifierListStats | undefined>) {
  return [...new Set(stats.filter(defined).map(getActivityLabel))].join('\n');
}

export function ClassifierActivity({labelSizer, result}: ClassifierActivityProps) {
  const theme = useTheme();
  const {data: stats, isError, isPending} = result;

  if (isPending) {
    return <Placeholder width="140px" height={`${SPARKLINE_HEIGHT}px`} />;
  }

  if (isError || !stats) {
    return (
      <Text size="sm" variant="muted">
        {t('Unavailable')}
      </Text>
    );
  }

  return (
    <Flex align="center" gap="md" flex="1" minWidth="0">
      <Container flex="1" minWidth="0">
        <MiniBarChart
          height={SPARKLINE_HEIGHT}
          isGroupedByDate
          showTimeInTooltip
          hideDelay={50}
          tooltip={SPARKLINE_TOOLTIP}
          colors={[theme.tokens.dataviz.semantic.accent]}
          yAxisMax={
            Math.max(0, ...stats.series.map(item => item.value ?? 0)) || undefined
          }
          series={[
            {
              seriesName: stats.hasMatches ? t('Matches') : t('Classified'),
              data: stats.series.map(item => ({
                name: item.timestamp,
                value: item.value ?? 0,
              })),
            },
          ]}
        />
      </Container>
      <Stack align="start">
        <InfoText
          title={getSummary(stats)}
          size="sm"
          variant={stats.hasMatches ? undefined : 'muted'}
          tabular
          wrap="nowrap"
        >
          {stats.hasMatches ? (
            <Fragment>
              {formatAbbreviatedNumber(stats.matches)}
              <Text variant="muted">/{formatAbbreviatedNumber(stats.classified)}</Text>
            </Fragment>
          ) : (
            getActivityLabel(stats)
          )}
        </InfoText>
        <Text size="sm" tabular>
          {props => <LabelSizer {...props} data-label={labelSizer} />}
        </Text>
      </Stack>
    </Flex>
  );
}

const LabelSizer = styled('span')`
  height: 0;
  overflow: hidden;
  visibility: hidden;
  white-space: pre;

  &::after {
    content: attr(data-label);
  }
`;
