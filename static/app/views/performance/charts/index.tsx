import {Component, Fragment} from 'react';
import {InjectedRouter} from 'react-router';
import {Location} from 'history';

import {Client} from 'sentry/api';
import EventsRequest from 'sentry/components/charts/eventsRequest';
import LoadingPanel from 'sentry/components/charts/loadingPanel';
import {HeaderTitle} from 'sentry/components/charts/styles';
import {getInterval} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconWarning} from 'sentry/icons';
import {Organization} from 'sentry/types';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import EventView from 'sentry/utils/discover/eventView';
import getDynamicText from 'sentry/utils/getDynamicText';
import withApi from 'sentry/utils/withApi';

import {getAxisOptions} from '../data';
import {DoubleHeaderContainer, ErrorPanel} from '../styles';

import Chart from './chart';
import Footer from './footer';

type Props = {
  api: Client;
  eventView: EventView;
  location: Location;
  organization: Organization;
  router: InjectedRouter;
};

class Container extends Component<Props> {
  getChartParameters() {
    const {location, organization} = this.props;
    const options = getAxisOptions(organization);
    const left = options.find(opt => opt.value === location.query.left) || options[0];
    const right = options.find(opt => opt.value === location.query.right) || options[1];

    return [left, right];
  }

  render() {
    const {api, organization, location, eventView} = this.props;

    // construct request parameters for fetching chart data
    const globalSelection = eventView.getPageFilters();
    const start = globalSelection.datetime.start
      ? getUtcToLocalDateObject(globalSelection.datetime.start)
      : null;
    const end = globalSelection.datetime.end
      ? getUtcToLocalDateObject(globalSelection.datetime.end)
      : null;

    const {utc} = normalizeDateTimeParams(location.query);
    const axisOptions = this.getChartParameters();

    const apiPayload = eventView.getEventsAPIPayload(location);

    return (
      <Panel>
        <EventsRequest
          organization={organization}
          api={api}
          period={globalSelection.datetime.period}
          project={globalSelection.projects}
          environment={globalSelection.environments}
          team={apiPayload.team}
          start={start}
          end={end}
          interval={getInterval(
            {
              start,
              end,
              period: globalSelection.datetime.period,
            },
            'high'
          )}
          showLoading={false}
          query={apiPayload.query}
          includePrevious={false}
          yAxis={axisOptions.map(opt => opt.value)}
          partial
        >
          {({loading, reloading, errored, results}) => {
            if (errored) {
              return (
                <ErrorPanel>
                  <IconWarning color="gray300" size="lg" />
                </ErrorPanel>
              );
            }

            return (
              <Fragment>
                <DoubleHeaderContainer>
                  {axisOptions.map((option, i) => (
                    <div key={`${option.label}:${i}`}>
                      <HeaderTitle>
                        {option.label}
                        <QuestionTooltip
                          position="top"
                          size="sm"
                          title={option.tooltip}
                        />
                      </HeaderTitle>
                    </div>
                  ))}
                </DoubleHeaderContainer>
                {results ? (
                  getDynamicText({
                    value: (
                      <Chart
                        data={results}
                        loading={loading || reloading}
                        statsPeriod={globalSelection.datetime.period}
                        start={start}
                        end={end}
                        utc={utc === 'true'}
                      />
                    ),
                    fixed: <Placeholder height="200px" testId="skeleton-ui" />,
                  })
                ) : (
                  <LoadingPanel data-test-id="events-request-loading" />
                )}
              </Fragment>
            );
          }}
        </EventsRequest>
        <Footer
          api={api}
          leftAxis={axisOptions[0].value}
          rightAxis={axisOptions[1].value}
          organization={organization}
          eventView={eventView}
          location={location}
        />
      </Panel>
    );
  }
}

export default withApi(Container);
