import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import MarkLine from 'sentry/components/charts/components/markLine';
import LoadingPanel from 'sentry/components/charts/loadingPanel';
import ScatterSeries from 'sentry/components/charts/series/scatterSeries';
import type {
  MetricsSummary,
  MetricsSummaryItem,
} from 'sentry/components/events/interfaces/spans/types';
import {Hovercard} from 'sentry/components/hovercard';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import Link from 'sentry/components/links/link';
import {normalizeDateTimeString} from 'sentry/components/organizations/pageFilters/parse';
import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {
  MetricsQueryApiResponseLastMeta,
  MetricType,
  MRI,
  Organization,
} from 'sentry/types';
import {defined} from 'sentry/utils';
import {getDefaultMetricOp, getMetricsUrl} from 'sentry/utils/metrics';
import {hasCustomMetrics} from 'sentry/utils/metrics/features';
import {formatMetricUsingUnit} from 'sentry/utils/metrics/formatters';
import {formatMRI, parseMRI} from 'sentry/utils/metrics/mri';
import {MetricDisplayType} from 'sentry/utils/metrics/types';
import {useMetricsQuery} from 'sentry/utils/metrics/useMetricsQuery';
import {middleEllipsis} from 'sentry/utils/middleEllipsis';
import type {Color} from 'sentry/utils/theme';
import useOrganization from 'sentry/utils/useOrganization';
import {MetricChart} from 'sentry/views/metrics/chart/chart';
import type {Series} from 'sentry/views/metrics/chart/types';
import {getChartTimeseries} from 'sentry/views/metrics/widget';
import {getSampleChartSymbol} from 'sentry/views/starfish/views/spanSummaryPage/sampleList/durationChart/getSampleChartSymbol';

function flattenMetricsSummary(
  metricsSummary: MetricsSummary
): {item: MetricsSummaryItem; mri: MRI}[] {
  return (
    Object.entries(metricsSummary) as [
      keyof MetricsSummary,
      MetricsSummary[keyof MetricsSummary],
    ][]
  ).flatMap(([mri, items]) => (items || []).map(item => ({item, mri})));
}

function tagToQuery(tagKey: string, tagValue: string) {
  return `${tagKey}:"${tagValue}"`;
}

const HALF_HOUR_IN_MS = 30 * 60 * 1000;

interface DataRow {
  chartUnit: string;
  metricType: MetricType;
  metricUnit: string;
  mri: MRI;
  scalingFactor: number;
  summaryItem: MetricsSummaryItem;
  chartSeries?: Series;
  deviation?: number;
  deviationPercent?: number;
  itemAvg?: number;
  totalAvg?: number;
}

export function CustomMetricsEventData({
  metricsSummary,
  startTimestamp,
  projectId,
}: {
  projectId: string;
  startTimestamp: number;
  metricsSummary?: MetricsSummary;
}) {
  const organization = useOrganization();
  const start = new Date(startTimestamp * 1000 - HALF_HOUR_IN_MS).toISOString();
  const end = new Date(startTimestamp * 1000 + HALF_HOUR_IN_MS).toISOString();

  const metricsSummaryEntries = useMemo(
    () => (metricsSummary ? flattenMetricsSummary(metricsSummary) : []),
    [metricsSummary]
  );

  const queries = useMemo(
    () =>
      metricsSummaryEntries.map((entry, index) => ({
        mri: entry.mri,
        name: index.toString(),
        op: getDefaultMetricOp(entry.mri),
        query: Object.entries(entry.item.tags ?? {})
          .map(([tagKey, tagValue]) => tagToQuery(tagKey, tagValue))
          .join(' '),
      })),
    [metricsSummaryEntries]
  );

  const {data} = useMetricsQuery(queries, {
    projects: [parseInt(projectId, 10)],
    datetime: {start, end, period: null, utc: true},
    environments: [],
  });

  const chartSeries = useMemo(
    () =>
      data
        ? data.data.flatMap((entry, index) => {
            // Splitting the response to treat it like individual requests
            // TODO: improve utils for metric series generation
            return getChartTimeseries(
              {...data, data: [entry], meta: [data.meta[index]]},
              [queries[index]],
              {
                showQuerySymbol: false,
              }
            );
          })
        : [],
    [data, queries]
  );

  const dataRows = useMemo(
    () =>
      metricsSummaryEntries
        .map<DataRow>((entry, index) => {
          const entryData = data?.data?.[index][0];
          const dataMeta = data?.meta?.[index];
          const lastMeta = dataMeta?.[
            dataMeta?.length - 1
          ] as MetricsQueryApiResponseLastMeta;
          const parsedMRI = parseMRI(entry.mri);
          const type = parsedMRI?.type || 'c';
          const unit = parsedMRI?.unit || 'none';
          const summaryItem = entry.item;
          const scalingFactor = lastMeta?.scaling_factor || 1;
          const totalAvg = entryData?.totals;
          const itemAvg =
            summaryItem.sum && summaryItem.count
              ? summaryItem.sum / summaryItem.count
              : undefined;
          const deviation =
            itemAvg && totalAvg ? itemAvg - totalAvg / scalingFactor : undefined;
          const deviationPercent =
            deviation && totalAvg ? deviation / (totalAvg / scalingFactor) : undefined;

          return {
            mri: entry.mri,
            itemAvg,
            totalAvg,
            scalingFactor,
            chartSeries: chartSeries[index],
            chartUnit: lastMeta?.unit ?? 'none',
            metricType: type,
            metricUnit: unit,
            summaryItem: summaryItem,
            deviation,
            deviationPercent,
          };
        })
        .sort((a, b) => {
          // Counters should be on bottom
          if (a.metricType === 'c' && b.metricType !== 'c') {
            return 1;
          }

          if (a.metricType !== 'c' && b.metricType === 'c') {
            return -1;
          }

          // Sort by highest absolute deviation
          return Math.abs(b.deviationPercent || 0) - Math.abs(a.deviationPercent || 0);
        }),
    [chartSeries, data?.data, data?.meta, metricsSummaryEntries]
  );

  if (!hasCustomMetrics(organization) || metricsSummaryEntries.length === 0) {
    return null;
  }

  return (
    <table className="table key-value">
      <tbody>
        <tr>
          <td className="key">{t('Emitted Metrics')}</td>
          <td className="value">
            <pre>
              {dataRows.map((dataRow, index) => (
                <Fragment key={index}>
                  <MetricRenderer
                    dataRow={dataRow}
                    start={start}
                    end={end}
                    organization={organization}
                  />
                  <br />
                  <ValueRenderer dataRow={dataRow} />{' '}
                  <DeviationRenderer dataRow={dataRow} startTimestamp={startTimestamp} />
                  <br />
                  <TagsRenderer tags={dataRow.summaryItem.tags} />
                  <br />
                  <br />
                </Fragment>
              ))}
            </pre>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function MetricRenderer({
  dataRow,
  start,
  end,
  organization,
}: {
  dataRow: DataRow;
  end: string;
  organization: Organization;
  start: string;
}) {
  const {mri, summaryItem} = dataRow;
  return (
    <Fragment>
      {t('Name:')}{' '}
      <Link
        to={getMetricsUrl(organization.slug, {
          start: normalizeDateTimeString(start),
          end: normalizeDateTimeString(end),
          interval: '10s',
          widgets: [
            {
              mri: mri,
              displayType: MetricDisplayType.LINE,
              op: getDefaultMetricOp(mri),
              query: Object.entries(summaryItem.tags ?? {})
                .map(([tagKey, tagValue]) => tagToQuery(tagKey, tagValue))
                .join(' '),
            },
          ],
        })}
      >
        {formatMRI(mri)}
      </Link>
    </Fragment>
  );
}

function ValueRenderer({dataRow}: {dataRow: DataRow}) {
  const {mri, summaryItem} = dataRow;
  const parsedMRI = parseMRI(mri);
  const unit = parsedMRI?.unit ?? 'none';
  const type = parsedMRI?.type ?? 'c';

  // For counters the other stats offer little value, so we only show the count
  if (type === 'c' || !summaryItem.count) {
    return t('Count: %s', formatMetricUsingUnit(summaryItem.count, 'none'));
  }

  const avg = summaryItem.sum && summaryItem.count && summaryItem.sum / summaryItem.count;

  return (
    <ValueWrapper>
      {t('Value:')} {formatMetricUsingUnit(avg, unit) ?? t('(none)')}
      {summaryItem.count > 1 && (
        <ValuesHovercard
          bodyClassName="hovercard-body"
          skipWrapper
          body={
            <Fragment>
              <StyledKeyValueTable>
                <KeyValueTableRow keyName="count" value={summaryItem.count} />
                <KeyValueTableRow
                  keyName="min"
                  value={formatMetricUsingUnit(summaryItem.min, unit)}
                />
                <KeyValueTableRow
                  keyName="max"
                  value={formatMetricUsingUnit(summaryItem.max, unit)}
                />
                <KeyValueTableRow
                  keyName="avg"
                  value={formatMetricUsingUnit(avg, unit)}
                />
              </StyledKeyValueTable>
            </Fragment>
          }
        >
          <IconInfo size="sm" color="gray300" />
        </ValuesHovercard>
      )}
    </ValueWrapper>
  );
}

function DeviationRenderer({
  dataRow,
  startTimestamp,
}: {
  dataRow: DataRow;
  startTimestamp: number;
}) {
  const {
    mri,
    totalAvg,
    itemAvg,
    deviation,
    deviationPercent,
    chartUnit,
    chartSeries,
    scalingFactor,
  } = dataRow;
  const theme = useTheme();
  const parsedMRI = parseMRI(mri);
  const type = parsedMRI?.type ?? 'c';

  if (!totalAvg) {
    return (
      <ValueCell>
        <LoadingPanel height="20px" />
      </ValueCell>
    );
  }

  if (
    !defined(totalAvg) ||
    !defined(itemAvg) ||
    !defined(deviation) ||
    !defined(deviationPercent) ||
    type === 'c'
  ) {
    return null;
  }
  const totals = totalAvg / scalingFactor;
  const isPositive = deviation > 0;
  const isNeutral = Math.abs(deviationPercent) < 0.03;

  const valueColor: Color = isNeutral ? 'gray300' : isPositive ? 'red300' : 'green300';

  const sign = deviation === 0 ? '±' : isPositive ? '+' : '';
  const symbol = isNeutral ? '' : isPositive ? '▲' : '▼';

  return (
    <ChartHovercard
      bodyClassName="hovercard-body"
      showUnderline
      underlineColor={valueColor}
      header={
        <Fragment>
          <HoverCardHeading>{`avg(${middleEllipsis(formatMRI(mri), 40, /\.|-|_/)})`}</HoverCardHeading>
          <HoverCardSubheading>{t("Span's start time -/+ 30 min")}</HoverCardSubheading>
        </Fragment>
      }
      body={
        chartSeries && (
          <MetricChart
            displayType={MetricDisplayType.LINE}
            series={[
              {
                ...chartSeries,
                markLine: MarkLine({
                  data: [
                    {
                      valueDim: 'y',
                      type: 'average',
                      yAxis: totalAvg,
                    },
                  ],
                  lineStyle: {
                    color: theme.gray400,
                  },
                  emphasis: {disabled: true},
                }),
              },
            ]}
            additionalSeries={[
              ScatterSeries({
                xAxisIndex: 0,
                yAxisIndex: 0,
                z: 10,
                data: [
                  {
                    value: [startTimestamp * 1000, itemAvg * (scalingFactor || 1)],
                    label: {
                      show: true,
                      position: 'right',
                      borderColor: 'transparent',
                      backgroundColor: theme.background,
                      borderRadius: 6,
                      padding: 4,
                      color: theme[valueColor],
                      formatter: params => {
                        return `${formatMetricUsingUnit(
                          (params.data as any).value[1],
                          chartUnit || 'none'
                        )}`;
                      },
                    },
                  },
                ],
                ...getSampleChartSymbol(itemAvg, totals, theme),
                symbolSize: 14,
                animation: false,
                silent: true,
              }),
            ]}
            height={160}
          />
        )
      }
    >
      <DeviationValue textColor={valueColor}>
        {symbol} {sign}
        {formatMetricUsingUnit(deviationPercent * 100, 'percent')}
      </DeviationValue>
    </ChartHovercard>
  );
}

const STANDARD_TAGS = ['environment', 'release', 'transaction'];

function TagsRenderer({tags}: {tags: Record<string, string> | null}) {
  const tagString = Object.entries(tags || {})
    .filter(([tagKey]) => !STANDARD_TAGS.includes(tagKey))
    .reduce((acc, [tagKey, tagValue], index) => {
      if (index > 0) {
        acc += ', ';
      }
      acc += `${tagKey}:${tagValue}`;
      return acc;
    }, '');

  if (tagString === '') {
    return (
      <Fragment>
        {t('Tags:')} <NoValue>{t('(none)')}</NoValue>
      </Fragment>
    );
  }

  return t('Tags: %s', tagString);
}

const ChartHovercard = styled(Hovercard)`
  width: 450px;
`;

const ValueCell = styled('div')`
  display: flex;
  align-items: center;
  font-family: ${p => p.theme.text.familyMono};
`;

const NoValue = styled('span')`
  color: ${p => p.theme.gray300};
`;

const ValueWrapper = styled(ValueCell)`
  display: inline-grid;
  grid-template-columns: max-content max-content;
  gap: ${space(1)};
  align-items: center;
`;

const DeviationValue = styled('span')<{
  textColor: Color;
}>`
  color: ${p => p.theme[p.textColor]};
  cursor: default;
`;

const HoverCardHeading = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  padding-bottom: ${space(0.5)};
`;

const HoverCardSubheading = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;

const ValuesHovercard = styled(Hovercard)`
  width: 200px;
  & .hovercard-body {
    padding: ${space(0.5)};
  }
`;

const StyledKeyValueTable = styled(KeyValueTable)`
  margin-bottom: 0;
`;
