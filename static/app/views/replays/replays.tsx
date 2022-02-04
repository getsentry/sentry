import {Fragment} from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import AsyncComponent from 'sentry/components/asyncComponent';
import FeatureBadge from 'sentry/components/featureBadge';
import Link from 'sentry/components/links/link';
import PageHeading from 'sentry/components/pageHeading';
import Pagination from 'sentry/components/pagination';
import {Panel, PanelBody, PanelItem} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {PageHeader} from 'sentry/styles/organization';
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
  };

type State = AsyncView['state'] & {
  replayList: Replay[] | null;
};

class Replays extends AsyncView<Props, State> {
  // example params to eventsv2
  // TODO: remove this

  // {'field': ['title', 'count()', 'count_unique(user)', 'project'], 'per_page': ['50'], 'project': ['2'], 'query': ['event.type:error'], 'referrer': ['api.discover.query-table'], 'sort': ['-count'], 'statsPeriod': ['24h']
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {
      organization,
      // query,
      // start,
      // end,
      // statsPeriod,
      // environment,
      // project,
      // fields,
      location,
    } = this.props;

    const eventView = EventView.fromSavedQuery({
      id: '',
      name: '',
      version: 2,
      fields: ['eventID', 'timestamp'],
      orderby: '',
      projects: [2],
      range: '30d',
      query: 'event.type:error', // future: change to replay event
      // environment: '',
      // start,
      // end,
    });
    const apiPayload = eventView.getEventsAPIPayload(location);
    apiPayload.referrer = 'api.performance.durationpercentilechart';

    return [
      ['eventData', `/organizations/${organization.slug}/eventsv2/`, {query: apiPayload}],
    ];
  }
  // getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
  //   const {params, location} = this.props;
  //   return [
  //     [
  //       'replayList',
  //       `/organizations/${params.orgId}/replays/`,
  //       {
  //         query: location.query,
  //       },
  //     ],
  //   ];
  // }

  getTitle() {
    return `Replays - ${this.props.params.orgId}`;
  }

  renderBody() {
    const {eventData, replayListPageLinks} = this.state;
    const {organization} = this.props;

    // eslint-disable-next-line no-debugger
    const replayList = eventData.data;
    return (
      <Fragment>
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
                <StyledLink
                  to={`/organizations/${organization.slug}/replays/${generateEventSlug({
                    project: replay['project.name'],
                    id: replay.id,
                  })}/`}
                >
                  {replay.timestamp}
                </StyledLink>
              </PanelItemCentered>
            ))}
          </PanelBody>
        </Panel>
        {replayListPageLinks && (
          <Pagination pageLinks={replayListPageLinks} {...this.props} />
        )}
      </Fragment>
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
  align-items: center;
  padding: 0;
  padding-left: ${space(2)};
  padding-right: ${space(2)};
`;

const StyledLink = styled(Link)`
  flex: 1;
  padding: ${space(2)};
`;

export default withRouter(withOrganization(Replays));
