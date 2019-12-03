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

class Results extends React.Component<Props> {
  constructor(props: Props) {
    super(props);
    this.eventView = EventView.fromLocation(props.location);
  }

  componentDidMount() {
    this.eventView = EventView.fromLocation(this.props.location);
  }

  componentDidUpdate() {
    this.eventView = EventView.fromLocation(this.props.location);
  }

  private eventView: EventView;

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
    if (!this.eventView) {
      return '';
    }
    return generateTitle({eventView: this.eventView});
  }

  renderTagsTable = () => {
    const {organization, location} = this.props;

    if (this.eventView.tags.length <= 0) {
      return null;
    }

    return (
      <Tags eventView={this.eventView} organization={organization} location={location} />
    );
  };

  render() {
    const {organization, location, router} = this.props;
    const query = location.query.query || '';

    // Make option set and add the default options in.
    const yAxisOptions = uniqBy(
      this.eventView
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
              eventView={this.eventView}
            />
            <div>
              <ContentBox>
                <Top>
                  <StyledSearchBar
                    organization={organization}
                    projectIds={this.eventView.project}
                    query={query}
                    onSearch={this.handleSearch}
                  />
                  <Panel>
                    {getDynamicText({
                      value: (
                        <EventsChart
                          router={router}
                          query={this.eventView.getEventsAPIPayload(location).query}
                          organization={organization}
                          showLegend
                          yAxisOptions={yAxisOptions}
                          yAxisValue={this.eventView.yAxis}
                          onYAxisChange={this.handleYAxisChange}
                          project={this.eventView.project as number[]}
                          environment={this.eventView.environment as string[]}
                        />
                      ),
                      fixed: 'events chart',
                    })}
                  </Panel>
                </Top>
                <Main>
                  <Table
                    organization={organization}
                    eventView={this.eventView}
                    location={location}
                  />
                </Main>
                <Side>{this.renderTagsTable()}</Side>
              </ContentBox>
            </div>
          </NoProjectMessage>
        </React.Fragment>
      </SentryDocumentTitle>
    );
  }
}

const StyledSearchBar = styled(SearchBar)`
  margin-bottom: ${space(2)};
`;

const Top = styled('div')`
  grid-column: 1/3;
  flex-grow: 0;
`;

const Main = styled('div')`
  grid-column: 1/2;
`;

const Side = styled('div')`
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
    grid-template-columns: auto 350px;
  }
`;

export default withOrganization(Results);
