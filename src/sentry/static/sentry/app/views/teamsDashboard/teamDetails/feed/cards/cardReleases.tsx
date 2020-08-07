import React from 'react';
import {forceCheck} from 'react-lazyload';
import styled from '@emotion/styled';

import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {t, tn} from 'app/locale';
import {Organization, Release, GlobalSelection} from 'app/types';
import AsyncComponent from 'app/components/asyncComponent';
import withOrganization from 'app/utils/withOrganization';
import LoadingIndicator from 'app/components/loadingIndicator';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import {getRelativeSummary} from 'app/components/organizations/timeRangeSelector/utils';
import ReleaseStats from 'app/components/releaseStats';
import NotAvailable from 'app/views/releasesV2/list/notAvailable';
import Link from 'app/components/links/link';
import space from 'app/styles/space';
import TimeSince from 'app/components/timeSince';
import DeployBadge from 'app/components/deployBadge';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import {PanelBody, PanelItem} from 'app/components/panels';

// import ReleaseCard from 'app/views/releasesV2/list/releaseCard';

import Card from './index';
// import SwitchReleasesButton from '../utils/switchReleasesButton';

type Props = {
  organization: Organization;
  selection: GlobalSelection;
} & Card['props'] &
  AsyncComponent['props'];
type State = {
  releases: Release[];
  loadingHealth: boolean;
} & AsyncComponent['state'];

class CardReleases extends AsyncComponent<Props, State> {
  shouldReload = true;

  getEndpoints() {
    const {organization} = this.props;
    const statsPeriod = '24h';
    const sort = this.getSort();

    const query = {
      //   ...pick(location.query, [
      //     'project',
      //     'environment',
      //     'cursor',
      //     'query',
      //     'sort',
      //     'healthStatsPeriod',
      //     'healthStat',
      //   ]),
      // TODO(dlee): add for project and env

      summaryStatsPeriod: statsPeriod,
      per_page: 25,
      health: 1,
      flatten: sort === 'date' ? 0 : 1,
    };

    const endpoints: ReturnType<AsyncComponent['getEndpoints']> = [
      ['releasesWithHealth', `/organizations/${organization.slug}/releases/`, {query}],
    ];

    // when sorting by date we fetch releases without health and then fetch health lazily
    if (sort === 'date') {
      endpoints.push([
        'releasesWithoutHealth',
        `/organizations/${organization.slug}/releases/`,
        {query: {...query, health: 0}},
      ]);
    }

    return endpoints;
  }

  onRequestSuccess({stateKey, data, jqXHR}) {
    const {remainingRequests} = this.state;

    // make sure there's no withHealth/withoutHealth race condition and set proper loading state
    if (stateKey === 'releasesWithHealth' || remainingRequests === 1) {
      this.setState({
        reloading: false,
        loading: false,
        loadingHealth: stateKey === 'releasesWithoutHealth',
        releases: data,
        releasesPageLinks: jqXHR?.getResponseHeader('Link'),
      });
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    super.componentDidUpdate(prevProps, prevState);

    if (prevState.releases !== this.state.releases) {
      /**
       * Manually trigger checking for elements in viewport.
       * Helpful when LazyLoad components enter the viewport without resize or scroll events,
       * https://github.com/twobin/react-lazyload#forcecheck
       *
       * HealthStatsCharts are being rendered only when they are scrolled into viewport.
       * This is how we re-check them without scrolling once releases change as this view
       * uses shouldReload=true and there is no reloading happening.
       */
      forceCheck();
    }
  }

  getSort() {
    return 'date';
  }

  shouldShowLoadingIndicator() {
    const {loading, releases, reloading} = this.state;

    return (loading && !reloading) || (loading && !releases?.length);
  }

  renderLoading() {
    return this.renderBody();
  }

  renderEmptyMessage() {
    const statsPeriod = '24h';
    const activeSort = this.getSort();

    if (activeSort === 'users_24h') {
      return (
        <EmptyStateWarning small>
          {t('There are no releases with active user data (users in the last 24 hours).')}
        </EmptyStateWarning>
      );
    }

    if (activeSort !== 'date') {
      const relativePeriod = getRelativeSummary(
        statsPeriod || DEFAULT_STATS_PERIOD
      ).toLowerCase();

      return (
        <EmptyStateWarning small>
          {`${t('There are no releases with data in the')} ${relativePeriod}.`}
        </EmptyStateWarning>
      );
    }

    return null;
  }

  renderInnerBody() {
    // const {selection, organization} = this.props;
    const {releases} = this.state;

    if (this.shouldShowLoadingIndicator()) {
      return <LoadingIndicator />;
    }

    if (!releases?.length) {
      return this.renderEmptyMessage();
    }

    // SHOW ONLY LAST 5 RELEASES
    return releases.reduce((acc, r, i) => {
      if (i < 5) {
        acc.push(
          <ListRow key={r.version}>
            <ListRowItem>
              <div>
                <span>
                  <Link style={{marginRight: 10}} to="">
                    {r.versionInfo.description}
                  </Link>
                  <em style={{fontSize: '12px'}}>
                    {r.lastDeploy?.dateFinished && (
                      <StyledDeployBadge deploy={r.lastDeploy} />
                    )}{' '}
                    {r.lastDeploy?.dateFinished ? t('Last Deployed') : t('Created')}{' '}
                    <TimeSince date={r.lastDeploy?.dateFinished || r.dateCreated} />
                  </em>
                  <br />
                </span>
              </div>

              <BadgeWrapper>
                {r.projects.map(p => (
                  <RowBadge key={p.id}>
                    <ProjectBadge project={p} avatarSize={12} />
                  </RowBadge>
                ))}
              </BadgeWrapper>
            </ListRowItem>

            <ListRowRight>
              <ListRowItem>
                <span style={{fontSize: '14px'}}>
                  {r.commitCount > 0
                    ? [
                        tn('%s commit', '%s commits', r.commitCount || 0),
                        t('by'),
                        tn('%s author', '%s authors', r.authors.length || 0),
                      ].join(' ')
                    : t('Commits')}
                </span>
                <span>
                  {r.commitCount > 0 ? (
                    <ReleaseStats release={r} withHeading={false} />
                  ) : (
                    <NotAvailable />
                  )}
                </span>
              </ListRowItem>

              <ListRowItem>
                <span style={{fontSize: '14px'}}>Users</span>
                <NotAvailable />
              </ListRowItem>

              <ListRowItem>
                <span style={{fontSize: '14px'}}>Sessions</span>
                <NotAvailable />
              </ListRowItem>

              <ListRowItem>
                <span style={{fontSize: '14px'}}>Crash %</span>
                <NotAvailable />
              </ListRowItem>

              <ListRowItem>
                <span style={{fontSize: '14px'}}>{t('New issues')}</span>
                <span>{r.newGroups || 0}</span>
              </ListRowItem>
            </ListRowRight>
          </ListRow>
        );
      }
      return acc;
    }, [] as React.ReactNode[]);
  }

  renderBody() {
    return (
      <Card {...this.props} columnSpan={2} isRemovable={false}>
        <PanelBody className="issue-list">{this.renderInnerBody()}</PanelBody>
      </Card>
    );
  }
}

export default withOrganization(CardReleases);
export {CardReleases};

const StyledDeployBadge = styled(DeployBadge)`
  position: relative;
  bottom: ${space(0.25)};
  margin-right: ${space(1)};
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;

const ListRow = styled(PanelItem)`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  color: ${p => p.theme.textColor};
`;

const ListRowItem = styled('div')`
  display: flex;
  flex-direction: column;
`;

const ListRowRight = styled('div')`
  display: flex;
  flex-direction: row;

  > ${ListRowItem} {
    width: 90px;
    /* border-left: 1px solid ${p => p.theme.borderLight}; */
    padding: 0 6px;
    text-align: center;
  }
`;
const BadgeWrapper = styled('div')`
  display: flex;
  flex-direction: row;
  font-size: 12px;
`;
const RowBadge = styled('div')`
  display: inline-block;
  padding: 0px 4px;
  border: 1px solid ${p => p.theme.borderDark};
  border-radius: ${p => p.theme.borderRadius};
`;
