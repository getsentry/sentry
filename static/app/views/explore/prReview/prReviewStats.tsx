import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {BarChart} from 'sentry/components/charts/barChart';
import Legend from 'sentry/components/charts/components/legend';
import {ScoreCard, ScorePanel} from 'sentry/components/scoreCard';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getFormattedDate} from 'sentry/utils/dates';
import type {CodeReviewStats} from 'sentry/views/explore/prReview/types';
import {formatStatus} from 'sentry/views/explore/prReview/utils';

const LABEL_INTERVAL: Record<string, number> = {
  '24h': 2,
  '7d': 0,
  '14d': 0,
  '30d': 2,
  '90d': 6,
};

interface Props {
  stats: CodeReviewStats | undefined;
  timeRange: string;
  statusFilter?: string;
}

function generateDateRange(timeRange: string): Date[] {
  const dates: Date[] = [];
  const now = new Date();

  if (timeRange === '24h') {
    for (let i = 23; i >= 0; i--) {
      const date = new Date(now);
      // Use UTC hours to match server-side TruncHour(trigger_at) which truncates in UTC
      date.setUTCHours(date.getUTCHours() - i, 0, 0, 0);
      dates.push(date);
    }
  } else {
    const days: Record<string, number> = {
      '7d': 7,
      '14d': 14,
      '30d': 30,
      '90d': 90,
    };
    const count = days[timeRange] ?? 14;
    for (let i = count - 1; i >= 0; i--) {
      const date = new Date(now);
      // Use UTC date arithmetic to match server-side TruncDay(trigger_at) which truncates in UTC
      date.setUTCDate(date.getUTCDate() - i);
      date.setUTCHours(0, 0, 0, 0);
      dates.push(date);
    }
  }

  return dates;
}

function toBucketKey(dateStr: string, hourly: boolean): string {
  // For hourly: "2026-02-18T14" — for daily: "2026-02-18"
  return hourly ? dateStr.slice(0, 13) : dateStr.slice(0, 10);
}

export function PrReviewStats({stats, statusFilter, timeRange}: Props) {
  const theme = useTheme();

  const hourly = timeRange === '24h';

  const {series, xAxisLabels} = useMemo(() => {
    if (!stats) {
      return {series: [], xAxisLabels: []};
    }

    const dataByDate = new Map<string, (typeof stats.timeSeries)[0]>();
    for (const entry of stats.timeSeries) {
      dataByDate.set(toBucketKey(entry.date, hourly), entry);
    }

    const allDates = generateDateRange(timeRange);
    // Use UTC formatting to match server-side UTC bucketing (TruncDay/TruncHour on trigger_at)
    const labelFormat = hourly ? 'LT' : 'MMM D';
    const labels = allDates.map(d => getFormattedDate(d, labelFormat, {local: false}));

    type TimeSeriesEntry = CodeReviewStats['timeSeries'][0];
    const empty: TimeSeriesEntry = {
      prs: 0,
      reviewed: 0,
      skipped: 0,
      comments: 0,
      date: '',
    };

    const makeSeries = (
      name: string,
      getValue: (entry: TimeSeriesEntry) => number,
      stack?: string
    ) => ({
      seriesName: name,
      ...(stack ? {stack} : {}),
      data: allDates.map((d, i) => {
        const key = toBucketKey(d.toISOString(), hourly);
        return {name: labels[i]!, value: getValue(dataByDate.get(key) ?? empty)};
      }),
    });

    return {
      xAxisLabels: labels,
      series: [
        makeSeries(t('PRs'), e => e.prs),
        makeSeries(t('Reviews'), e => e.reviewed, 'outcomes'),
        makeSeries(t('Skipped'), e => e.skipped, 'outcomes'),
        makeSeries(t('Comments'), e => e.comments),
      ],
    };
  }, [stats, timeRange, hourly]);

  if (!stats) {
    return null;
  }

  return (
    <Grid gap="md">
      <Grid columns="repeat(3, 1fr)" gap="md">
        <StyledScoreCard
          title={statusFilter ? t('%s PRs', formatStatus(statusFilter)) : t('Total PRs')}
          score={stats.stats.totalPrs}
          trend={t('%d skipped', stats.stats.skippedPrs)}
        />
        <StyledScoreCard
          title={t('Reviews')}
          score={stats.stats.totalReviews}
          trend={t('%d comments posted', stats.stats.totalComments)}
        />
        <AuthorsCard>
          <Flex align="baseline" justify="between">
            <Text size="lg" bold>
              {t('Authors')}
            </Text>
            <Text size="xs" bold uppercase variant="muted">
              {t('Top Authors')}
            </Text>
          </Flex>
          <Flex align="end" justify="between" gap="md">
            <AuthorsCount>{stats.stats.totalAuthors}</AuthorsCount>
            <TopAuthors>
              {stats.stats.topAuthors.map(({author, prCount}) => (
                <Flex key={author} gap="sm" justify="end">
                  <Text as="span" size="sm">
                    {author}
                  </Text>
                  <Text as="span" size="sm" variant="muted">
                    {tn('%s PR', '%s PRs', prCount)}
                  </Text>
                </Flex>
              ))}
            </TopAuthors>
          </Flex>
        </AuthorsCard>
      </Grid>
      <div style={{minWidth: 0}}>
        <BarChart
          height={200}
          series={series}
          legend={Legend({
            right: 0,
            top: 0,
            data: series.map(s => ({name: s.seriesName})),
            theme,
          })}
          xAxis={{
            type: 'category',
            data: xAxisLabels,
            axisTick: {alignWithLabel: true},
            axisLabel: {
              interval: LABEL_INTERVAL[timeRange] ?? 0,
              showMinLabel: true,
              showMaxLabel: true,
              color: theme.tokens.content.secondary,
              fontFamily: theme.font.family.sans,
              // Override XAxis default formatter which returns '' for non-date category axes
              formatter: (value: string) => value,
            },
          }}
          tooltip={{trigger: 'axis'}}
          grid={{top: '36px', bottom: '0', left: '0', right: '0', containLabel: true}}
          yAxis={{
            axisLabel: {
              color: theme.tokens.content.secondary,
              fontFamily: theme.font.family.sans,
            },
            splitLine: {show: false},
          }}
        />
      </div>
    </Grid>
  );
}

const StyledScoreCard = styled(ScoreCard)`
  margin: 0;
`;

const AuthorsCard = styled(ScorePanel)`
  margin: 0;
`;

const AuthorsCount = styled('span')`
  font-size: 32px;
  line-height: 1;
  color: ${p => p.theme.tokens.content.primary};
`;

const TopAuthors = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.25)};
  text-align: right;
`;
