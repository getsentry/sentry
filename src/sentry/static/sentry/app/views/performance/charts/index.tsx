import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import * as ReactRouter from 'react-router';

import {Organization} from 'app/types';
import {Client} from 'app/api';
import withApi from 'app/utils/withApi';
import {getInterval} from 'app/components/charts/utils';
import LoadingPanel from 'app/views/events/loadingPanel';
import Tooltip from 'app/components/tooltip';
import getDynamicText from 'app/utils/getDynamicText';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {Panel} from 'app/components/panels';
import EventView from 'app/utils/discover/eventView';
import EventsRequest from 'app/views/events/utils/eventsRequest';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import {IconWarning} from 'app/icons';
import theme from 'app/utils/theme';
import space from 'app/styles/space';

import {HeaderTitle, StyledIconQuestion} from '../styles';
import Chart from './chart';
import Footer from './footer';

const YAXIS_OPTIONS = [
  {
    label: 'Apdex',
    value: 'apdex(300)',
    tooltip:
      'Apdex is a ratio of satisfactory response times to unsatisfactory response times.',
  },
  {
    label: 'Throughput',
    value: 'rpm()',
    tooltip: 'Throughput is the number of recorded transactions per minute (tpm).',
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

            if (!results) {
              return <LoadingPanel data-test-id="events-request-loading" />;
            }

            return (
              <React.Fragment>
                <HeaderContainer>
                  {YAXIS_OPTIONS.map(option => (
                    <HeaderTitle key={option.label}>
                      {option.label}
                      <Tooltip position="top" title={option.tooltip}>
                        <StyledIconQuestion size="sm" />
                      </Tooltip>
                    </HeaderTitle>
                  ))}
                </HeaderContainer>
                {getDynamicText({
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
                  fixed: 'performance charts',
                })}
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

const ErrorPanel = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;

  flex: 1;
  flex-shrink: 0;
  overflow: hidden;
  height: 200px;
  position: relative;
  border-color: transparent;
  margin-bottom: 0;
`;

const HeaderContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-gap: ${space(2)};
  padding: ${space(2)} ${space(1.5)} ${space(1)} ${space(1.5)};
`;

export default withApi(Container);
