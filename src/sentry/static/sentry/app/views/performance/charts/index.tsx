import React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/browser';
import {Location} from 'history';
import * as ReactRouter from 'react-router';

import {Organization} from 'app/types';
import {Client} from 'app/api';
import withApi from 'app/utils/withApi';
import {getInterval} from 'app/components/charts/utils';
import LoadingPanel from 'app/views/events/loadingPanel';
import getDynamicText from 'app/utils/getDynamicText';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {Panel} from 'app/components/panels';
import EventView from 'app/views/eventsV2/eventView';
import {fetchTotalCount} from 'app/views/eventsV2/utils';
import EventsRequest from 'app/views/events/utils/eventsRequest';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import {IconWarning} from 'app/icons';
import theme from 'app/utils/theme';

import Chart from './chart';
import Footer from './footer';

const YAXIS_OPTIONS = ['apdex()', 'rpm()'];

type Props = {
  api: Client;
  eventView: EventView;
  organization: Organization;
  location: Location;
  router: ReactRouter.InjectedRouter;
};

type State = {
  totalValues: null | number;
};

class Container extends React.Component<Props, State> {
  state: State = {
    totalValues: null,
  };

  componentDidMount() {
    this.mounted = true;

    // TODO: implement later
    // this.fetchTotalCount();
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  mounted: boolean = false;

  async fetchTotalCount() {
    const {api, organization, location, eventView} = this.props;
    if (!eventView.isValid() || !this.mounted) {
      return;
    }

    try {
      const totals = await fetchTotalCount(
        api,
        organization.slug,
        eventView.getEventsAPIPayload(location)
      );

      if (this.mounted) {
        this.setState({totalValues: totals});
      }
    } catch (err) {
      Sentry.captureException(err);
    }
  }

  render() {
    const {api, organization, location, eventView, router} = this.props;

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
        <ChartsContainer>
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
            yAxis={YAXIS_OPTIONS}
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

              return YAXIS_OPTIONS.map(yAxis => {
                return (
                  <React.Fragment key={yAxis}>
                    {getDynamicText({
                      value: (
                        <Chart
                          loading={loading || reloading}
                          yAxis={yAxis}
                          data={results[yAxis]}
                          router={router}
                          statsPeriod={globalSelection.statsPeriod}
                          utc={utc === 'true'}
                          projects={globalSelection.project}
                          environments={globalSelection.environment}
                        />
                      ),
                      fixed: 'events chart',
                    })}
                  </React.Fragment>
                );
              });
            }}
          </EventsRequest>
        </ChartsContainer>
        <Footer totals={this.state.totalValues} />
      </Panel>
    );
  }
}

export const ChartsContainer = styled('div')`
  display: flex;
`;

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

export default withApi(Container);
