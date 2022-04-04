import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/featureBadge';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import PageHeading from 'sentry/components/pageHeading';
import {Panel, PanelBody, PanelItem} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {PageContent, PageHeader} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {NewQuery, Organization, PageFilters} from 'sentry/types';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import AsyncView from 'sentry/views/asyncView';

import {Replay} from './types';

type Props = AsyncView['props'] &
  WithRouterProps<{orgId: string}> & {
    organization: Organization;
    selection: PageFilters;
    statsPeriod?: string | undefined; // revisit i'm sure i'm doing statsperiod wrong
  };

class Replays extends React.Component<Props> {
  getEventView() {
    const {location, selection} = this.props;

    const eventQueryParams: NewQuery = {
      id: '',
      name: '',
      version: 2,
      fields: ['eventID', 'timestamp', 'replayId'],
      orderby: '-timestamp',
      environment: selection.environments,
      projects: selection.projects,
      query: 'transaction:sentry-replay', // future: change to replay event
    };

    if (selection.datetime.period) {
      eventQueryParams.range = selection.datetime.period;
    }
    return EventView.fromNewQueryWithLocation(eventQueryParams, location);
  }

  getTitle() {
    return `Replays - ${this.props.params.orgId}`;
  }

  renderTable(replayList: Array<Replay>) {
    const {organization} = this.props;
    return replayList?.map(replay => (
      <PanelItemCentered key={replay.id}>
        <Link
          to={`/organizations/${organization.slug}/replays/${generateEventSlug({
            project: replay['project.name'],
            id: replay.id,
          })}/`}
        >
          {replay.timestamp}
        </Link>
        {replay.replayId}
      </PanelItemCentered>
    ));
  }

  render() {
    const {organization} = this.props;
    return (
      <PageFiltersContainer
        showEnvironmentSelector={false}
        resetParamsOnChange={['cursor']}
      >
        <PageContent>
          <PageHeader>
            <HeaderTitle>
              <div>
                {t('Replays')} <FeatureBadge type="beta" />
              </div>
            </HeaderTitle>
          </PageHeader>
          <Panel>
            <PanelBody>
              <DiscoverQuery
                eventView={this.getEventView()}
                location={this.props.location}
                orgSlug={organization.slug}
              >
                {data => {
                  if (data.isLoading) {
                    return <LoadingIndicator />;
                  }
                  return this.renderTable(data.tableData.data);
                }}
              </DiscoverQuery>
            </PanelBody>
          </Panel>
        </PageContent>
      </PageFiltersContainer>
    );
  }
}

const HeaderTitle = styled(PageHeading)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
`;

const PanelItemCentered = styled(PanelItem)`
  display: grid;
  grid-template-columns: auto max-content;
  gap: ${space(2)};
  padding: ${space(2)};
`;

export default withRouter(withPageFilters(withOrganization(Replays)));
