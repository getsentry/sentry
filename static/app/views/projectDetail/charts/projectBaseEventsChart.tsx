import {Component} from 'react';
import * as Sentry from '@sentry/react';
import isEqual from 'lodash/isEqual';

import {fetchTotalCount} from 'sentry/actionCreators/events';
import type {EventsChartProps} from 'sentry/components/charts/eventsChart';
import EventsChart from 'sentry/components/charts/eventsChart';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {axisLabelFormatter} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import getDynamicText from 'sentry/utils/getDynamicText';
import withPageFilters from 'sentry/utils/withPageFilters';

type Props = Omit<
  EventsChartProps,
  keyof Omit<PageFilters, 'datetime'> | keyof PageFilters['datetime']
> & {
  onTotalValuesChange: (value: number | null) => void;
  selection: PageFilters;
  title: string;
  yAxis: string;
  help?: string;
};

class ProjectBaseEventsChart extends Component<Props> {
  componentDidMount() {
    this.fetchTotalCount();
  }

  componentDidUpdate(prevProps: Props) {
    if (!isSelectionEqual(this.props.selection, prevProps.selection)) {
      this.fetchTotalCount();
    }
  }

  async fetchTotalCount() {
    const {
      api,
      organization,
      selection,
      onTotalValuesChange,
      query,
      dataset = DiscoverDatasets.METRICS_ENHANCED,
    } = this.props;
    const {projects, environments, datetime} = selection;

    try {
      const totals = await fetchTotalCount(api, organization.slug, {
        field: [],
        query,
        dataset,
        environment: environments,
        project: projects.map(proj => String(proj)),
        ...normalizeDateTimeParams(datetime),
      });
      onTotalValuesChange(totals);
    } catch (err) {
      onTotalValuesChange(null);
      Sentry.captureException(err);
    }
  }

  render() {
    const {
      location,
      organization,
      selection,
      api,
      yAxis,
      query,
      field,
      title,
      help,
      dataset = DiscoverDatasets.METRICS_ENHANCED,
      ...eventsChartProps
    } = this.props;
    const {projects, environments, datetime} = selection;
    const {start, end, period, utc} = datetime;

    return getDynamicText({
      value: (
        <EventsChart
          {...eventsChartProps}
          location={location}
          organization={organization}
          showLegend
          yAxis={yAxis}
          query={query}
          api={api}
          projects={projects}
          dataset={dataset}
          environments={environments}
          start={start}
          end={end}
          period={period}
          utc={utc}
          field={field}
          currentSeriesName={t('This Period')}
          previousSeriesName={t('Previous Period')}
          disableableSeries={[t('This Period'), t('Previous Period')]}
          chartHeader={
            <HeaderTitleLegend>
              {title}
              {help && <QuestionTooltip size="sm" position="top" title={help} />}
            </HeaderTitleLegend>
          }
          legendOptions={{right: 10, top: 0}}
          chartOptions={{
            grid: {left: '10px', right: '10px', top: '40px', bottom: '0px'},
            yAxis: {
              axisLabel: {
                formatter: (value: number) =>
                  axisLabelFormatter(value, aggregateOutputType(yAxis)),
              },
              scale: true,
            },
          }}
        />
      ),
      fixed: `${title} Chart`,
    });
  }
}

/**
 * Compare the non-utc values of two selections.
 * Useful when re-fetching data based on page filters changing.
 *
 * utc is not compared as there is a problem somewhere in the selection
 * data flow that results in it being undefined | null | boolean instead of null | boolean.
 * The additional undefined state makes this function just as unreliable as isEqual(selection, other)
 */
function isSelectionEqual(selection: PageFilters, other: PageFilters): boolean {
  if (
    !isEqual(selection.projects, other.projects) ||
    !isEqual(selection.environments, other.environments)
  ) {
    return false;
  }

  // Use string comparison as we aren't interested in the identity of the datetimes.
  if (
    selection.datetime.period !== other.datetime.period ||
    selection.datetime.start?.toString() !== other.datetime.start?.toString() ||
    selection.datetime.end?.toString() !== other.datetime.end?.toString()
  ) {
    return false;
  }

  return true;
}

export default withPageFilters(ProjectBaseEventsChart);
