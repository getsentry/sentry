import React from 'react';
import {Location} from 'history';
import * as ReactRouter from 'react-router';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {Organization, GlobalSelection} from 'app/types';
import space from 'app/styles/space';
import {t} from 'app/locale';
import {Client} from 'app/api';
import {formatVersion} from 'app/utils/formatters';
import EventView from 'app/utils/discover/eventView';
import {EventsChart} from 'app/views/events/eventsChart';
import {fetchTotalCount} from 'app/actionCreators/events';
import {getUtcDateString} from 'app/utils/dates';
import {Panel} from 'app/components/panels';
import getDynamicText from 'app/utils/getDynamicText';
import {
  ChartControls,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'app/components/charts/styles';

type Props = {
  organization: Organization;
  selection: GlobalSelection;
  api: Client;
  location: Location;
  router: ReactRouter.InjectedRouter;
  version: string;
};

type State = {
  totalEvents: null | number;
};

class DiscoverChartContainer extends React.Component<Props, State> {
  state: State = {
    totalEvents: null,
  };

  componentDidMount() {
    this.fetchTotalCount();
  }

  componentDidUpdate(prevProps: Props) {
    const {version, organization, selection} = this.props;
    if (
      prevProps.version !== version ||
      !isEqual(prevProps.organization, organization) ||
      !isEqual(prevProps.selection, selection)
    ) {
      this.fetchTotalCount();
    }
  }

  async fetchTotalCount() {
    const {api, organization, location} = this.props;

    const totalEvents = await fetchTotalCount(
      api,
      organization.slug,
      this.getEventView().getEventsAPIPayload(location)
    );
    this.setState({totalEvents});
  }

  getEventView(): EventView {
    const {selection, version} = this.props;
    const {projects, environments, datetime} = selection;
    const {start, end, period} = datetime;

    const discoverQuery = {
      id: undefined,
      version: 2,
      name: `${t('Release')} ${formatVersion(version)}`,
      fields: ['title', 'count()', 'event.type', 'issue', 'last_seen()'],
      query: `release:${version} !event.type:transaction`,
      orderby: '-last_seen',
      range: period,
      environments,
      projects,
      start: start ? getUtcDateString(start) : undefined,
      end: end ? getUtcDateString(end) : undefined,
    } as const;

    return EventView.fromSavedQuery(discoverQuery);
  }

  render() {
    const {totalEvents} = this.state;
    const {organization, location, api, router, selection} = this.props;
    const {projects, environments, datetime} = selection;
    const {start, end, period, utc} = datetime;
    const eventView = this.getEventView();

    return (
      <StyledPanel>
        {getDynamicText({
          value: (
            <React.Fragment>
              <EventsChart
                router={router}
                organization={organization}
                showLegend
                yAxis={eventView.getYAxis()}
                query={eventView.getEventsAPIPayload(location).query}
                api={api}
                projects={projects}
                environments={environments}
                start={start}
                end={end}
                period={period}
                utc={utc}
                disablePrevious
                currentSeriesName={t('Events')}
              />
              <ChartControls>
                <InlineContainer>
                  <SectionHeading>{t('Total Events')}</SectionHeading>
                  <SectionValue>
                    {totalEvents === null ? '\u2015' : totalEvents.toLocaleString()}
                  </SectionValue>
                </InlineContainer>
              </ChartControls>
            </React.Fragment>
          ),
          fixed: 'events chart',
        })}
      </StyledPanel>
    );
  }
}

const StyledPanel = styled(Panel)`
  margin-bottom: ${space(3)};
`;

export default DiscoverChartContainer;
