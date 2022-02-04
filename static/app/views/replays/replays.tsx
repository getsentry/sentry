import {Fragment} from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/featureBadge';
import Link from 'sentry/components/links/link';
import PageHeading from 'sentry/components/pageHeading';
import Pagination from 'sentry/components/pagination';
import {Panel, PanelBody, PanelItem} from 'sentry/components/panels';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {PageHeader} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';
import MonitorIcon from 'sentry/views/monitors/monitorIcon';

import {Monitor} from '../monitors/types';

type Props = AsyncView['props'] &
  WithRouterProps<{orgId: string}> & {
    organization: Organization;
  };

type State = AsyncView['state'] & {
  replayList: Monitor[] | null;
};

class Monitors extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {params, location} = this.props;
    return [
      [
        'replayList',
        `/organizations/${params.orgId}/replays/`,
        {
          query: location.query,
        },
      ],
    ];
  }

  getTitle() {
    return `Replays - ${this.props.params.orgId}`;
  }

  renderBody() {
    const {replayList, replayListPageLinks} = this.state;
    const {organization} = this.props;
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
            {replayList?.map(monitor => (
              <PanelItemCentered key={monitor.id}>
                <MonitorIcon status={monitor.status} size={16} />
                <StyledLink
                  to={`/organizations/${organization.slug}/monitors/${monitor.id}/`}
                >
                  {monitor.name}
                </StyledLink>
                {monitor.nextCheckIn ? (
                  <StyledTimeSince date={monitor.lastCheckIn} />
                ) : (
                  t('n/a')
                )}
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

const StyledTimeSince = styled(TimeSince)`
  font-variant-numeric: tabular-nums;
`;

export default withRouter(withOrganization(Monitors));
