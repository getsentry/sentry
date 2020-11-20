import React from 'react';
import * as ReactRouter from 'react-router';
import {Location} from 'history';

import {Client} from 'app/api';
import EventsRequest from 'app/components/charts/eventsRequest';
import LoadingPanel from 'app/components/charts/loadingPanel';
import {getInterval} from 'app/components/charts/utils';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {Panel} from 'app/components/panels';
import QuestionTooltip from 'app/components/questionTooltip';
import {IconWarning} from 'app/icons';
import {Organization} from 'app/types';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import EventView from 'app/utils/discover/eventView';
import getDynamicText from 'app/utils/getDynamicText';
import withApi from 'app/utils/withApi';

import {getAxisOptions} from '../data';
import {ErrorPanel, HeaderContainer, HeaderTitle} from '../styles';

import Chart from './chart';
import Footer from './footer';

type Props = {
  api: Client;
  eventView: EventView;
  organization: Organization;
  location: Location;
  router: ReactRouter.InjectedRouter;
};

class Container extends React.Component<Props> {
  getChartParameters() {
    const {location, organization} = this.props;
    const options = getAxisOptions(organization);
    const left = options.find(opt => opt.value === location.query.left) || options[0];
    const right = options.find(opt => opt.value === location.query.right) || options[1];

    return [left, right];
  }

  render() {
    const {api, organization, location, eventView, router} = this.props;

    // construct request parameters for fetching chart data
    const globalSelection = eventView.getGlobalSelection();
    const start = globalSelection.datetime.start
      ? getUtcToLocalDateObject(globalSelection.datetime.start)
      : undefined;

    const end = globalSelection.datetime.end
      ? getUtcToLocalDateObject(globalSelection.datetime.end)
      : undefined;

    const {utc} = getParams(location.query);
    const axisOptions = this.getChartParameters();

    return (
      <Panel>
        <EventsRequest
          organization={organization}
          api={api}
          period={globalSelection.datetime.period}
          project={globalSelection.projects}
          environment={globalSelection.environments}
          start={start}
          end={end}
          interval={getInterval(
            {
              start: start || null,
              end: end || null,
              period: globalSelection.datetime.period,
            },
            true
          )}
          showLoading={false}
          query={eventView.getEventsAPIPayload(location).query}
          includePrevious={false}
          yAxis={axisOptions.map(opt => opt.value)}
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
              <React.Fragment>
                <HeaderContainer>
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
                </HeaderContainer>
                {results ? (
                  getDynamicText({
                    value: (
                      <Chart
                        data={results}
                        loading={loading || reloading}
                        router={router}
                        statsPeriod={globalSelection.datetime.period}
                        utc={utc === 'true'}
                        projects={globalSelection.projects}
                        environments={globalSelection.environments}
                      />
                    ),
                    fixed: 'apdex and throughput charts',
                  })
                ) : (
                  <LoadingPanel data-test-id="events-request-loading" />
                )}
              </React.Fragment>
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
