import React from 'react';
import * as ReactRouter from 'react-router';
import * as Sentry from '@sentry/react';
import {Location} from 'history';

import {fetchTotalCount} from 'app/actionCreators/events';
import {Client} from 'app/api';
import EventsChart from 'app/components/charts/eventsChart';
import QuestionTooltip from 'app/components/questionTooltip';
import {t} from 'app/locale';
import {GlobalSelection, Organization} from 'app/types';
import {getUtcDateString} from 'app/utils/dates';
import EventView, {isAPIPayloadSimilar} from 'app/utils/discover/eventView';
import getDynamicText from 'app/utils/getDynamicText';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import {getTermHelp} from 'app/views/performance/data';
import {HeaderTitleLegend} from 'app/views/performance/styles';

type Props = {
  api: Client;
  organization: Organization;
  location: Location;
  router: ReactRouter.InjectedRouter;
  selection: GlobalSelection;
  onTotalValuesChange: (value: number | null) => void;
};

class ProjectApdexChart extends React.Component<Props> {
  componentDidMount() {
    this.fetchTotalCount();
  }

  componentDidUpdate(prevProps: Props) {
    const currentAPIPayload = this.getEventView(this.props).getEventsAPIPayload(
      this.props.location
    );
    const previousAPIPayload = this.getEventView(prevProps).getEventsAPIPayload(
      prevProps.location
    );

    if (!isAPIPayloadSimilar(currentAPIPayload, previousAPIPayload)) {
      this.fetchTotalCount();
    }
  }

  async fetchTotalCount() {
    const {api, organization, location, onTotalValuesChange} = this.props;
    const eventView = this.getEventView(this.props);

    if (!eventView.isValid()) {
      return;
    }

    try {
      const totals = await fetchTotalCount(
        api,
        organization.slug,
        eventView.getEventsAPIPayload(location)
      );
      onTotalValuesChange(totals);
    } catch (err) {
      onTotalValuesChange(null);
      Sentry.captureException(err);
    }
  }

  getEventView(props: Props) {
    const {organization, selection} = props;
    const {projects, environments, datetime} = selection;
    const {start, end, period} = datetime;

    return EventView.fromSavedQuery({
      id: undefined,
      version: 2,
      name: t('Apdex'),
      query: 'event.type:transaction',
      fields: [`apdex(${organization.apdexThreshold})`],
      range: period,
      environment: environments,
      projects,
      start: start ? getUtcDateString(start) : undefined,
      end: end ? getUtcDateString(end) : undefined,
    });
  }

  render() {
    const {location, router, organization, selection, api} = this.props;
    const {projects, environments, datetime} = selection;
    const {start, end, period, utc} = datetime;

    const eventView = this.getEventView(this.props);
    const apiPayload = eventView.getEventsAPIPayload(location);

    return getDynamicText({
      value: (
        <EventsChart
          router={router}
          organization={organization}
          showLegend
          yAxis={eventView.getYAxis()}
          query={apiPayload.query}
          api={api}
          projects={projects}
          environments={environments}
          start={start}
          end={end}
          period={period}
          utc={utc}
          field={eventView.getFields()}
          currentSeriesName={t('This Period')}
          previousSeriesName={t('Previous Period')}
          disableableSeries={[t('This Period'), t('Previous Period')]}
          chartHeader={
            <HeaderTitleLegend>
              {t('Apdex')}
              <QuestionTooltip
                size="sm"
                position="top"
                title={getTermHelp(organization, 'apdex')}
              />
            </HeaderTitleLegend>
          }
          legendOptions={{right: 10, top: 0}}
          chartOptions={{grid: {left: '10px', right: '10px', top: '40px', bottom: '0px'}}}
        />
      ),
      fixed: 'Apdex Chart',
    });
  }
}

export default withGlobalSelection(ProjectApdexChart);
