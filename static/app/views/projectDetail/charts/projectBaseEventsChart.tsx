import {Component} from 'react';
import * as Sentry from '@sentry/react';

import {fetchTotalCount} from 'sentry/actionCreators/events';
import EventsChart, {EventsChartProps} from 'sentry/components/charts/eventsChart';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {isSelectionEqual} from 'sentry/components/organizations/pageFilters/utils';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {PageFilters} from 'sentry/types';
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
    const {api, organization, selection, onTotalValuesChange, query} = this.props;
    const {projects, environments, datetime} = selection;

    try {
      const totals = await fetchTotalCount(api, organization.slug, {
        field: [],
        query,
        dataset: DiscoverDatasets.METRICS_ENHANCED,
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
      router,
      organization,
      selection,
      api,
      yAxis,
      query,
      field,
      title,
      help,
      ...eventsChartProps
    } = this.props;
    const {projects, environments, datetime} = selection;
    const {start, end, period, utc} = datetime;

    return getDynamicText({
      value: (
        <EventsChart
          {...eventsChartProps}
          router={router}
          organization={organization}
          showLegend
          yAxis={yAxis}
          query={query}
          api={api}
          projects={projects}
          dataset={DiscoverDatasets.METRICS_ENHANCED}
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

export default withPageFilters(ProjectBaseEventsChart);
