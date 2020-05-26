import React from 'react';
import {Location} from 'history';
import * as ReactRouter from 'react-router';

import {Organization} from 'app/types';
import {Client} from 'app/api';
import withApi from 'app/utils/withApi';
import {getInterval} from 'app/components/charts/utils';
import LoadingPanel from 'app/components/charts/loadingPanel';
import QuestionTooltip from 'app/components/questionTooltip';
import getDynamicText from 'app/utils/getDynamicText';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {Panel} from 'app/components/panels';
import EventView from 'app/utils/discover/eventView';
import EventsRequest from 'app/views/events/utils/eventsRequest';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import {IconWarning} from 'app/icons';
import theme from 'app/utils/theme';

import {PERFORMANCE_TERMS} from '../constants';
import {HeaderContainer, HeaderTitle, ErrorPanel} from '../styles';
import Chart from './chart';
import Footer from './footer';

const YAXIS_OPTIONS = [
  {
    label: 'Apdex',
    value: 'apdex(300)',
    tooltip: PERFORMANCE_TERMS.apdex,
  },
  {
    label: 'Transactions per Minute',
    value: 'epm()',
    tooltip: PERFORMANCE_TERMS.tpm,
  },
];

type Props = {
  api: Client;
  eventView: EventView;
  organization: Organization;
  location: Location;
  router: ReactRouter.InjectedRouter;
  keyTransactions: boolean;
};

class Container extends React.Component<Props> {
  render() {
    const {api, organization, location, eventView, router, keyTransactions} = this.props;

    // construct request parameters for fetching chart data

    const globalSelection = eventView.getGlobalSelection();
    const start = globalSelection.start
      ? getUtcToLocalDateObject(globalSelection.start)
      : undefined;

    const end = globalSelection.end
      ? getUtcToLocalDateObject(globalSelection.end)
      : undefined;

    const {utc} = getParams(location.query);

    return (
      <Panel>
        <EventsRequest
          organization={organization}
          api={api}
          period={globalSelection.statsPeriod}
          project={globalSelection.project}
          environment={globalSelection.environment}
          start={start}
          end={end}
          interval={getInterval(
            {
              start: start || null,
              end: end || null,
              period: globalSelection.statsPeriod,
            },
            true
          )}
          showLoading={false}
          query={eventView.getEventsAPIPayload(location).query}
          includePrevious={false}
          yAxis={YAXIS_OPTIONS.map(option => option.value)}
          keyTransactions={keyTransactions}
        >
          {({loading, reloading, errored, results}) => {
            if (errored) {
              return (
                <ErrorPanel>
                  <IconWarning color={theme.gray2} size="lg" />
                </ErrorPanel>
              );
            }

            return (
              <React.Fragment>
                <HeaderContainer>
                  {YAXIS_OPTIONS.map(option => (
                    <div key={option.label}>
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
                        statsPeriod={globalSelection.statsPeriod}
                        utc={utc === 'true'}
                        projects={globalSelection.project}
                        environments={globalSelection.environment}
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
          organization={organization}
          eventView={eventView}
          location={location}
        />
      </Panel>
    );
  }
}

export default withApi(Container);
