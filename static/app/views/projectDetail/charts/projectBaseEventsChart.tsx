import {Component} from 'react';
import {withTheme} from '@emotion/react';
import * as Sentry from '@sentry/react';

import {fetchTotalCount} from 'app/actionCreators/events';
import EventsChart, {EventsChartProps} from 'app/components/charts/eventsChart';
import {HeaderTitleLegend} from 'app/components/charts/styles';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {isSelectionEqual} from 'app/components/organizations/globalSelectionHeader/utils';
import QuestionTooltip from 'app/components/questionTooltip';
import {t} from 'app/locale';
import {GlobalSelection} from 'app/types';
import {axisLabelFormatter} from 'app/utils/discover/charts';
import getDynamicText from 'app/utils/getDynamicText';
import {Theme} from 'app/utils/theme';
import withGlobalSelection from 'app/utils/withGlobalSelection';

type Props = Omit<
  EventsChartProps,
  keyof Omit<GlobalSelection, 'datetime'> | keyof GlobalSelection['datetime']
> & {
  title: string;
  selection: GlobalSelection;
  onTotalValuesChange: (value: number | null) => void;
  theme: Theme;
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
        environment: environments,
        project: projects.map(proj => String(proj)),
        ...getParams(datetime),
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
      theme,
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
                color: theme.gray200,
                formatter: (value: number) => axisLabelFormatter(value, yAxis),
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

export default withGlobalSelection(withTheme(ProjectBaseEventsChart));
