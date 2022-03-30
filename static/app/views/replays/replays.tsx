import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import AsyncComponent from 'sentry/components/asyncComponent';
import FeatureBadge from 'sentry/components/featureBadge';
import Link from 'sentry/components/links/link';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import PageHeading from 'sentry/components/pageHeading';
import Pagination from 'sentry/components/pagination';
import {Panel, PanelBody, PanelItem} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {PageContent, PageHeader} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';

import {Replay} from './types';

type Props = AsyncView['props'] &
  WithRouterProps<{orgId: string}> & {
    organization: Organization;
    statsPeriod?: string | undefined; // revisit i'm sure i'm doing statsperiod wrong
  };

type State = AsyncView['state'] & {
  replayList: Replay[] | null;
};

class Replays extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, statsPeriod, location} = this.props;

    const eventView = EventView.fromSavedQuery({
      id: '',
      name: '',
      version: 2,
      fields: ['eventID', 'timestamp', 'replayId'],
      orderby: '-timestamp',
      projects: [],
      range: statsPeriod,
      query: 'transaction:sentry-replay', // future: change to replay event
    });
    const apiPayload = eventView.getEventsAPIPayload(location);
    return [
      ['eventData', `/organizations/${organization.slug}/eventsv2/`, {query: apiPayload}],
    ];
  }
  getTitle() {
    return `Replays - ${this.props.params.orgId}`;
  }

  renderLoading() {
    return <PageContent>{super.renderLoading()}</PageContent>;
  }

  renderBody() {
    const {eventData, replayListPageLinks} = this.state;
    const {organization} = this.props;

    const replayList = eventData.data;
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
              {replayList?.map(replay => (
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
              ))}
            </PanelBody>
          </Panel>
          {replayListPageLinks && (
            <Pagination pageLinks={replayListPageLinks} {...this.props} />
          )}
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

export default withRouter(withOrganization(Replays));
