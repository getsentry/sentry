import {useState} from 'react';
import {Location} from 'history';

import {BarChart} from 'sentry/components/charts/barChart';
import BarChartZoom from 'sentry/components/charts/barChartZoom';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import LoadingPanel from 'sentry/components/charts/loadingPanel';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {OrganizationSummary} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import Histogram from 'sentry/utils/performance/histogram';
import HistogramQuery from 'sentry/utils/performance/histogram/histogramQuery';
import {HistogramData} from 'sentry/utils/performance/histogram/types';
import {
  computeBuckets,
  formatHistogramData,
} from 'sentry/utils/performance/histogram/utils';
import theme from 'sentry/utils/theme';
import toArray from 'sentry/utils/toArray';

import {ViewProps} from '../../../types';
import {filterToColor, filterToField, SpanOperationBreakdownFilter} from '../../filter';

import {decodeHistogramZoom, ZOOM_END, ZOOM_START} from './utils';

const NUM_BUCKETS = 50;

type Props = ViewProps & {
  currentFilter: SpanOperationBreakdownFilter;
  location: Location;
  organization: OrganizationSummary;
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
}: Props) {
  const [zoomError, setZoomError] = useState(false);

  function handleMouseOver() {
    // Hide the zoom error tooltip on the next hover.
    if (zoomError) {
      setZoomError(false);
    }
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
      currentFilter === SpanOperationBreakdownFilter.None
        ? [...theme.charts.getColorPalette(1)]
        : [filterToColor(currentFilter)];

    // Use a custom tooltip formatter as we need to replace
    // the tooltip content entirely when zooming is no longer available.
    const tooltip = {
      formatter(series) {
        const seriesData = toArray(series);
        let contents: string[] = [];
        if (!zoomError) {
          // Replicate the necessary logic from sentry/components/charts/components/tooltip.jsx
          contents = seriesData.map(item => {
            const label = item.seriesName;
            const value = item.value[1].toLocaleString();
            return [
              '<div class="tooltip-series">',
              `<div><span class="tooltip-label">${item.marker} <strong>${label}</strong></span> ${value}</div>`,
              '</div>',
            ].join('');
          });
          const seriesLabel = seriesData[0].value[0];
          contents.push(`<div class="tooltip-date">${seriesLabel}</div>`);
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

    const series = {
      seriesName: t('Count'),
      data: formatHistogramData(data, {type: 'duration'}),
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
            yAxis={{type: 'value'}}
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
