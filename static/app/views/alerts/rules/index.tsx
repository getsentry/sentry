import {Component} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import flatten from 'lodash/flatten';

import {addErrorMessage} from 'app/actionCreators/indicator';
import AsyncComponent from 'app/components/asyncComponent';
import * as Layout from 'app/components/layouts/thirds';
import ExternalLink from 'app/components/links/externalLink';
import Link from 'app/components/links/link';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import Pagination from 'app/components/pagination';
import {PanelTable} from 'app/components/panels';
import SearchBar from 'app/components/searchBar';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {IconArrow} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, Organization, Project, Team} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import Projects from 'app/utils/projects';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withTeams from 'app/utils/withTeams';

import AlertHeader from '../list/header';
import {CombinedMetricIssueAlerts} from '../types';
import {isIssueAlert} from '../utils';

import RuleListRow from './row';
import TeamFilter, {getTeamParams} from './teamFilter';

const DOCS_URL = 'https://docs.sentry.io/product/alerts-notifications/metric-alerts/';

type Props = RouteComponentProps<{orgId: string}, {}> & {
  organization: Organization;
  selection: GlobalSelection;
  teams: Team[];
};

type State = {
  ruleList?: CombinedMetricIssueAlerts[];
  teamFilterSearch?: string;
};

class AlertRulesList extends AsyncComponent<Props, State & AsyncComponent['state']> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {params, location, organization} = this.props;
    const {query} = location;

    if (organization.features.includes('alert-details-redesign')) {
      query.expand = ['latestIncident'];
    }

    query.team = getTeamParams(query.team);

    if (organization.features.includes('alert-details-redesign') && !query.sort) {
      query.sort = ['incident_status', 'date_triggered'];
    }

    return [
      [
        'ruleList',
        `/organizations/${params && params.orgId}/combined-rules/`,
        {
          query,
        },
      ],
    ];
  }

  handleChangeFilter = (_sectionId: string, activeFilters: Set<string>) => {
    const {router, location} = this.props;
    const {cursor: _cursor, page: _page, ...currentQuery} = location.query;
    const teams = [...activeFilters];
    router.push({
      pathname: location.pathname,
      query: {
        ...currentQuery,
        team: teams.length ? teams : '',
      },
    });
  };

  handleChangeSearch = (name: string) => {
    const {router, location} = this.props;
    const {cursor: _cursor, page: _page, ...currentQuery} = location.query;
    router.push({
      pathname: location.pathname,
      query: {
        ...currentQuery,
        name,
      },
    });
  };

  handleDeleteRule = async (projectId: string, rule: CombinedMetricIssueAlerts) => {
    const {params} = this.props;
    const {orgId} = params;
    const alertPath = isIssueAlert(rule) ? 'rules' : 'alert-rules';

    try {
      await this.api.requestPromise(
        `/projects/${orgId}/${projectId}/${alertPath}/${rule.id}/`,
        {
          method: 'DELETE',
        }
      );
      this.reloadData();
    } catch (_err) {
      addErrorMessage(t('Error deleting rule'));
    }
  };

  renderLoading() {
    return this.renderBody();
  }

  renderFilterBar() {
    const {teams, location} = this.props;
    const selectedTeams = new Set(getTeamParams(location.query.team));

    return (
      <FilterWrapper>
        <TeamFilter
          teams={teams}
          selectedTeams={selectedTeams}
          handleChangeFilter={this.handleChangeFilter}
        />
        <StyledSearchBar
          placeholder={t('Search by name')}
          query={location.query?.name}
          onSearch={this.handleChangeSearch}
        />
      </FilterWrapper>
    );
  }

  renderList() {
    const {
      params: {orgId},
      location: {query},
      organization,
      teams,
    } = this.props;
    const {loading, ruleList = [], ruleListPageLinks} = this.state;

    const allProjectsFromIncidents = new Set(
      flatten(ruleList?.map(({projects}) => projects))
    );

    const sort: {
      asc: boolean;
      field: 'date_added' | 'name' | ['incident_status', 'date_triggered'];
    } = {
      asc: query.asc === '1',
      field: query.sort || 'date_added',
    };
    const {cursor: _cursor, page: _page, ...currentQuery} = query;
    const hasAlertList = organization.features.includes('alert-details-redesign');
    const isAlertRuleSort =
      sort.field.includes('incident_status') || sort.field.includes('date_triggered');
    const sortArrow = (
      <IconArrow color="gray300" size="xs" direction={sort.asc ? 'up' : 'down'} />
    );

    const userTeams = new Set(teams.filter(({isMember}) => isMember).map(({id}) => id));

    return (
      <StyledLayoutBody>
        <Layout.Main fullWidth>
          {this.renderFilterBar()}
          <StyledPanelTable
            headers={[
              ...(hasAlertList
                ? [
                    // eslint-disable-next-line react/jsx-key
                    <StyledSortLink
                      to={{
                        pathname: location.pathname,
                        query: {
                          ...currentQuery,
                          asc: sort.field === 'name' && !sort.asc ? '1' : undefined,
                          sort: 'name',
                        },
                      }}
                    >
                      {t('Alert Rule')} {sort.field === 'name' && sortArrow}
                    </StyledSortLink>,
                    // eslint-disable-next-line react/jsx-key
                    <StyledSortLink
                      to={{
                        pathname: location.pathname,
                        query: {
                          ...currentQuery,
                          asc: isAlertRuleSort && !sort.asc ? '1' : undefined,
                          sort: ['incident_status', 'date_triggered'],
                        },
                      }}
                    >
                      {t('Status')} {isAlertRuleSort && sortArrow}
                    </StyledSortLink>,
                  ]
                : [
                    t('Type'),
                    // eslint-disable-next-line react/jsx-key
                    <StyledSortLink
                      to={{
                        pathname: location.pathname,
                        query: {
                          ...currentQuery,
                          asc: sort.field === 'name' && !sort.asc ? '1' : undefined,
                          sort: 'name',
                        },
                      }}
                    >
                      {t('Alert Name')} {sort.field === 'name' && sortArrow}
                    </StyledSortLink>,
                  ]),
              t('Project'),
              t('Team'),
              ...(hasAlertList ? [] : [t('Created By')]),
              // eslint-disable-next-line react/jsx-key
              <StyledSortLink
                to={{
                  pathname: location.pathname,
                  query: {
                    ...currentQuery,
                    asc: sort.field === 'date_added' && !sort.asc ? '1' : undefined,
                    sort: 'date_added',
                  },
                }}
              >
                {t('Created')} {sort.field === 'date_added' && sortArrow}
              </StyledSortLink>,
              t('Actions'),
            ]}
            isLoading={loading}
            isEmpty={ruleList?.length === 0}
            emptyMessage={t('No alert rules found for the current query.')}
            emptyAction={
              <EmptyStateAction>
                {tct('Learn more about [link:Alerts]', {
                  link: <ExternalLink href={DOCS_URL} />,
                })}
              </EmptyStateAction>
            }
            hasAlertList={hasAlertList}
          >
            <Projects orgId={orgId} slugs={Array.from(allProjectsFromIncidents)}>
              {({initiallyLoaded, projects}) =>
                ruleList.map(rule => (
                  <RuleListRow
                    // Metric and issue alerts can have the same id
                    key={`${isIssueAlert(rule) ? 'metric' : 'issue'}-${rule.id}`}
                    projectsLoaded={initiallyLoaded}
                    projects={projects as Project[]}
                    rule={rule}
                    orgId={orgId}
                    onDelete={this.handleDeleteRule}
                    organization={organization}
                    userTeams={userTeams}
                  />
                ))
              }
            </Projects>
          </StyledPanelTable>
          <Pagination pageLinks={ruleListPageLinks} />
        </Layout.Main>
      </StyledLayoutBody>
    );
  }

  renderBody() {
    const {params, organization, router} = this.props;
    const {orgId} = params;

    return (
      <SentryDocumentTitle title={t('Alerts')} orgSlug={orgId}>
        <GlobalSelectionHeader
          organization={organization}
          showDateSelector={false}
          showEnvironmentSelector={false}
        >
          <AlertHeader organization={organization} router={router} activeTab="rules" />
          {this.renderList()}
        </GlobalSelectionHeader>
      </SentryDocumentTitle>
    );
  }
}

class AlertRulesListContainer extends Component<Props> {
  componentDidMount() {
    this.trackView();
  }

  componentDidUpdate(prevProps: Props) {
    const {location} = this.props;
    if (prevProps.location.query?.sort !== location.query?.sort) {
      this.trackView();
    }
  }

  trackView() {
    const {organization, location} = this.props;

    trackAnalyticsEvent({
      eventKey: 'alert_rules.viewed',
      eventName: 'Alert Rules: Viewed',
      organization_id: organization.id,
      sort: Array.isArray(location.query.sort)
        ? location.query.sort.join(',')
        : location.query.sort,
    });
  }

  render() {
    return <AlertRulesList {...this.props} />;
  }
}

export default withGlobalSelection(withTeams(AlertRulesListContainer));

const StyledLayoutBody = styled(Layout.Body)`
  margin-bottom: -20px;
`;

const StyledSortLink = styled(Link)`
  color: inherit;

  :hover {
    color: inherit;
  }
`;

const FilterWrapper = styled('div')`
  display: flex;
  margin-bottom: ${space(1.5)};
`;

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
  margin-left: ${space(1.5)};
`;

const StyledPanelTable = styled(PanelTable)<{hasAlertList: boolean}>`
  overflow: auto;
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    overflow: initial;
  }

  grid-template-columns: auto 1.5fr 1fr 1fr ${p => (!p.hasAlertList ? '1fr' : '')} 1fr auto;
  white-space: nowrap;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const EmptyStateAction = styled('p')`
  font-size: ${p => p.theme.fontSizeLarge};
`;
