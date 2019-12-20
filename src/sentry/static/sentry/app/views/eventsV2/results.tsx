import React from 'react';
import styled from 'react-emotion';
import * as ReactRouter from 'react-router';
import {Location} from 'history';
import omit from 'lodash/omit';
import uniqBy from 'lodash/uniqBy';

import {Organization} from 'app/types';

import {Panel} from 'app/components/panels';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import NoProjectMessage from 'app/components/noProjectMessage';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';

import {PageContent} from 'app/styles/organization';
import space from 'app/styles/space';

import SearchBar from 'app/views/events/searchBar';
import EventsChart from 'app/views/events/eventsChart';

import {trackAnalyticsEvent} from 'app/utils/analytics';
import getDynamicText from 'app/utils/getDynamicText';
import withOrganization from 'app/utils/withOrganization';

import Table from './table';
import Tags from './tags';
import ResultsHeader from './resultsHeader';
import EventView, {Field} from './eventView';
import {generateTitle} from './utils';

const CHART_AXIS_OPTIONS = [
  {label: 'count', value: 'count(id)'},
  {label: 'users', value: 'count_unique(user)'},
];

type Props = {
  router: ReactRouter.InjectedRouter;
  location: Location;
  organization: Organization;
};

type State = {
  eventView: EventView;
};

class Results extends React.Component<Props, State> {
  static getDerivedStateFromProps(nextProps: Props): State {
    const eventView = EventView.fromLocation(nextProps.location);
    return {eventView};
  }

  state = {
    eventView: EventView.fromLocation(this.props.location),
  };

  handleSearch = (query: string) => {
    const {router, location} = this.props;

    const queryParams = getParams({
      ...(location.query || {}),
      query,
    });

    // do not propagate pagination when making a new search
    const searchQueryParams = omit(queryParams, 'cursor');

    router.push({
      pathname: location.pathname,
      query: searchQueryParams,
    });
  };

  handleYAxisChange = (value: string) => {
    const {router, location} = this.props;

    const newQuery = {
      ...location.query,
      yAxis: value,
    };

    router.push({
      pathname: location.pathname,
      query: newQuery,
    });

    trackAnalyticsEvent({
      eventKey: 'discover_v2.y_axis_change',
      eventName: "Discoverv2: Change chart's y axis",
      organization_id: this.props.organization.id,
      y_axis_value: value,
    });
  };

  getDocumentTitle(): string {
    const {eventView} = this.state;
    if (!eventView) {
      return '';
    }
    return generateTitle({eventView});
  }

  renderTagsTable = () => {
    const {organization, location} = this.props;
    const {eventView} = this.state;

    if (eventView.tags.length <= 0) {
      return null;
    }

    return <Tags eventView={eventView} organization={organization} location={location} />;
  };

  render() {
    const {organization, location, router} = this.props;
    const {eventView} = this.state;
    const query = location.query.query || '';

    // Make option set and add the default options in.
    const yAxisOptions = uniqBy(
      eventView
        .getAggregateFields()
        // Exclude last_seen and latest_event as they don't produce useful graphs.
        .filter(
          (field: Field) => ['last_seen', 'latest_event'].includes(field.field) === false
        )
        .map((field: Field) => {
          return {label: field.title, value: field.field};
        })
        .concat(CHART_AXIS_OPTIONS),
      'value'
    );

    return (
      <SentryDocumentTitle title={this.getDocumentTitle()} objSlug={organization.slug}>
        <React.Fragment>
          <GlobalSelectionHeader organization={organization} />
          <NoProjectMessage organization={organization}>
            <ResultsHeader
              organization={organization}
              location={location}
              eventView={eventView}
            />
            <ContentBox>
              <Top>
                <StyledSearchBar
                  organization={organization}
                  projectIds={eventView.project}
                  query={query}
                  onSearch={this.handleSearch}
                />
                <StyledPanel>
                  {getDynamicText({
                    value: (
                      <EventsChart
                        router={router}
                        query={eventView.getEventsAPIPayload(location).query}
                        organization={organization}
                        showLegend
                        yAxisOptions={yAxisOptions}
                        yAxisValue={eventView.yAxis}
                        onYAxisChange={this.handleYAxisChange}
                        project={eventView.project as number[]}
                        environment={eventView.environment as string[]}
                      />
                    ),
                    fixed: 'events chart',
                  })}
                </StyledPanel>
              </Top>
              <Main eventView={eventView}>
                <Table
                  organization={organization}
                  eventView={eventView}
                  location={location}
                />
              </Main>
              <Side eventView={eventView}>{this.renderTagsTable()}</Side>
            </ContentBox>
          </NoProjectMessage>
        </React.Fragment>
      </SentryDocumentTitle>
    );
  }
}

const StyledSearchBar = styled(SearchBar)`
  margin-bottom: ${space(2)};
`;

const StyledPanel = styled(Panel)`
  margin-bottom: ${space(1.5)};

  .echarts-for-react div:first-child {
    width: 100% !important;
  }
`;

const Top = styled('div')`
  grid-column: 1/3;
  flex-grow: 0;
`;

const Main = styled('div')<{eventView: EventView}>`
  grid-column: ${p => (p.eventView.tags.length <= 0 ? '1/3' : '1/2')};

  /* Defining the width prevent child elements from expanding the grid
     past the width of the screen */
  width: 100%;
  max-width: 100%;
  overflow: hidden;
`;

const Side = styled('div')<{eventView: EventView}>`
  display: ${p => (p.eventView.tags.length <= 0 ? 'none' : 'initial')};
  grid-column: 2/3;
`;

const ContentBox = styled(PageContent)`
  margin: 0;

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    display: grid;
    grid-template-rows: 1fr auto;
    grid-template-columns: 65% auto;
    grid-column-gap: ${space(3)};
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: auto 325px;
  }
`;

export function generateDiscoverResultsRoute(orgSlug: string): string {
  return `/organizations/${orgSlug}/eventsv2/results/`;
}

export default withOrganization(Results);
