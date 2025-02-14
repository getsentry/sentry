import {useState} from 'react';
import {useTheme} from '@emotion/react';
import type {Location} from 'history';

import {BarChart} from 'sentry/components/charts/barChart';
import BarChartZoom from 'sentry/components/charts/barChartZoom';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import LoadingPanel from 'sentry/components/charts/loadingPanel';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {OrganizationSummary} from 'sentry/types/organization';
import toArray from 'sentry/utils/array/toArray';
import EventView from 'sentry/utils/discover/eventView';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import Histogram from 'sentry/utils/performance/histogram';
import HistogramQuery from 'sentry/utils/performance/histogram/histogramQuery';
import type {HistogramData} from 'sentry/utils/performance/histogram/types';
import {
  computeBuckets,
  formatHistogramData,
} from 'sentry/utils/performance/histogram/utils';

import type {ViewProps} from '../../../types';
import {filterToColor, filterToField, SpanOperationBreakdownFilter} from '../../filter';

import {decodeHistogramZoom, ZOOM_END, ZOOM_START} from './utils';

const NUM_BUCKETS = 50;

type Props = ViewProps & {
  currentFilter: SpanOperationBreakdownFilter;
  location: Location;
  organization: OrganizationSummary;
  queryExtras?: Record<string, string>;
  totalCount?: number | null;
};

/**
 * Fetch and render a bar chart that shows event volume
 * for each duration bucket. We always render 50 buckets of
 * equal widths based on the endpoints min + max durations.
 *
 * This graph visualizes how many transactions were recorded
 * at each duration bucket, showing the modality of the transaction.
 */
function Content({
  organization,
  query,
  start,
  end,
  statsPeriod,
  environment,
  project,
  location,
  currentFilter,
  queryExtras,
  totalCount,
}: Props) {
  const theme = useTheme();
  const [zoomError, setZoomError] = useState(false);

  function handleMouseOver() {
    // Hide the zoom error tooltip on the next hover.
    if (zoomError) {
      setZoomError(false);
    }
  }

  function parseHistogramData(data: HistogramData): HistogramData {
    // display each bin's count as a % of total count
    if (totalCount) {
      return data.map(({bin, count}) => ({bin, count: count / totalCount}));
    }
    return data;
  }

  function renderChart(data: HistogramData) {
    const xAxis = {
      type: 'category' as const,
      truncate: true,
      axisTick: {
        interval: 0,
        alignWithLabel: true,
      },
    };

    const colors =
      currentFilter === SpanOperationBreakdownFilter.NONE
        ? theme.charts.getColorPalette(1)
        : [filterToColor(currentFilter)];

    // Use a custom tooltip formatter as we need to replace
    // the tooltip content entirely when zooming is no longer available.
    const tooltip = {
      formatter(series: any) {
        const seriesData = toArray(series);
        let contents: string[] = [];
        if (!zoomError) {
          // Replicate the necessary logic from sentry/components/charts/components/tooltip.jsx
          contents = seriesData.map(item => {
            const label = t('Transactions');
            const value = formatPercentage(item.value[1]);

            return [
              '<div class="tooltip-series">',
              `<div><span class="tooltip-label">${item.marker} <strong>${label}</strong></span> ${value}</div>`,
              '</div>',
            ].join('');
          });
          const seriesLabel = seriesData[0].value[0];
          contents.push(`<div class="tooltip-footer">${seriesLabel}</div>`);
        } else {
          contents = [
            '<div class="tooltip-series tooltip-series-solo">',
            t('Target zoom region too small'),
            '</div>',
          ];
        }
        contents.push('<div class="tooltip-arrow"></div>');
        return contents.join('');
      },
    };

    const parsedData = parseHistogramData(data);

    const series = {
      seriesName: t('Count'),
      data: formatHistogramData(parsedData, {type: 'duration'}),
    };

    return (
      <BarChartZoom
        minZoomWidth={NUM_BUCKETS}
        location={location}
        paramStart={ZOOM_START}
        paramEnd={ZOOM_END}
        xAxisIndex={[0]}
        buckets={computeBuckets(data)}
        onDataZoomCancelled={() => setZoomError(true)}
      >
        {zoomRenderProps => (
          <BarChart
            grid={{left: '10px', right: '10px', top: '40px', bottom: '0px'}}
            xAxis={xAxis}
            yAxis={{
              type: 'value',
              axisLabel: {
                formatter: (value: any) => formatPercentage(value, 0),
              },
            }}
            series={[series]}
            tooltip={tooltip}
            colors={colors}
            onMouseOver={handleMouseOver}
            {...zoomRenderProps}
          />
        )}
      </BarChartZoom>
    );
  }

  const eventView = EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: '',
      fields: ['transaction.duration'],
      projects: project,
      range: statsPeriod,
      query,
      environment,
      start,
      end,
    },
    location
  );
  const {min, max} = decodeHistogramZoom(location);

  const field = filterToField(currentFilter) ?? 'transaction.duration';

  return (
    <Histogram location={location} zoomKeys={[ZOOM_START, ZOOM_END]}>
      {({activeFilter}) => (
        <HistogramQuery
          location={location}
          orgSlug={organization.slug}
          eventView={eventView}
          numBuckets={NUM_BUCKETS}
          fields={[field]}
          min={min}
          max={max}
          dataFilter={activeFilter.value}
          queryExtras={queryExtras}
        >
          {({histograms, isLoading, error}) => {
            if (isLoading) {
              return <LoadingPanel data-test-id="histogram-loading" />;
            }

            if (error) {
              return (
                <ErrorPanel>
                  <IconWarning color="gray300" size="lg" />
                </ErrorPanel>
              );
            }

            return renderChart(histograms?.[field] ?? []);
          }}
        </HistogramQuery>
      )}
    </Histogram>
  );
}

export default Content;
