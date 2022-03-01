import {Component} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import flatten from 'lodash/flatten';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import AsyncComponent from 'sentry/components/asyncComponent';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconArrow} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {Organization, PageFilters, Project} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import Projects from 'sentry/utils/projects';
import Teams from 'sentry/utils/teams';
import withPageFilters from 'sentry/utils/withPageFilters';

import FilterBar from '../filterBar';
import AlertHeader from '../list/header';
import {CombinedMetricIssueAlerts} from '../types';
import {getTeamParams, isIssueAlert} from '../utils';

import RuleListRow from './row';

const DOCS_URL = 'https://docs.sentry.io/product/alerts-notifications/metric-alerts/';

type Props = RouteComponentProps<{orgId: string}, {}> & {
  organization: Organization;
  selection: PageFilters;
};

type State = {
  ruleList?: CombinedMetricIssueAlerts[];
  teamFilterSearch?: string;
};

class AlertRulesList extends AsyncComponent<Props, State & AsyncComponent['state']> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {params, location} = this.props;
    const {query} = location;

    query.expand = ['latestIncident'];
    query.team = getTeamParams(query.team);

    if (!query.sort) {
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

  renderList() {
    const {
      params: {orgId},
      location,
      organization,
      router,
    } = this.props;
    const {loading, ruleList = [], ruleListPageLinks} = this.state;
    const {query} = location;

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
    const isAlertRuleSort =
      sort.field.includes('incident_status') || sort.field.includes('date_triggered');
    const sortArrow = (
      <IconArrow color="gray300" size="xs" direction={sort.asc ? 'up' : 'down'} />
    );

    return (
      <StyledLayoutBody>
        <Layout.Main fullWidth>
          <FilterBar
            location={location}
            onChangeFilter={this.handleChangeFilter}
            onChangeSearch={this.handleChangeSearch}
          />
          <Teams provideUserTeams>
            {({initiallyLoaded: loadedTeams, teams}) => (
              <StyledPanelTable
                headers={[
                  <StyledSortLink
                    key="name"
                    role="columnheader"
                    aria-sort={
                      sort.field !== 'name'
                        ? 'none'
                        : sort.asc
                        ? 'ascending'
                        : 'descending'
                    }
                    to={{
                      pathname: location.pathname,
                      query: {
                        ...currentQuery,
                        // sort by name should start by ascending on first click
                        asc: sort.field === 'name' && sort.asc ? undefined : '1',
                        sort: 'name',
                      },
                    }}
                  >
                    {t('Alert Rule')} {sort.field === 'name' && sortArrow}
                  </StyledSortLink>,

                  <StyledSortLink
                    key="status"
                    role="columnheader"
                    aria-sort={
                      !isAlertRuleSort ? 'none' : sort.asc ? 'ascending' : 'descending'
                    }
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

                  t('Project'),
                  t('Team'),
                  <StyledSortLink
                    key="dateAdded"
                    role="columnheader"
                    aria-sort={
                      sort.field !== 'date_added'
                        ? 'none'
                        : sort.asc
                        ? 'ascending'
                        : 'descending'
                    }
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
                isLoading={loading || !loadedTeams}
                isEmpty={ruleList?.length === 0}
                emptyMessage={t('No alert rules found for the current query.')}
                emptyAction={
                  <EmptyStateAction>
                    {tct('Learn more about [link:Alerts]', {
                      link: <ExternalLink href={DOCS_URL} />,
                    })}
                  </EmptyStateAction>
                }
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
                        userTeams={new Set(teams.map(team => team.id))}
                      />
                    ))
                  }
                </Projects>
              </StyledPanelTable>
            )}
          </Teams>
          <Pagination
            pageLinks={ruleListPageLinks}
            onCursor={(cursor, path, _direction) => {
              let team = currentQuery.team;
              // Keep team parameter, but empty to remove parameters
              if (!team || team.length === 0) {
                team = '';
              }

              router.push({
                pathname: path,
                query: {...currentQuery, team, cursor},
              });
            }}
          />
        </Layout.Main>
      </StyledLayoutBody>
    );
  }

  renderBody() {
    const {params, organization, router} = this.props;
    const {orgId} = params;

    return (
      <SentryDocumentTitle title={t('Alerts')} orgSlug={orgId}>
        <PageFiltersContainer
          organization={organization}
          showDateSelector={false}
          showEnvironmentSelector={false}
        >
          <AlertHeader organization={organization} router={router} activeTab="rules" />
          {this.renderList()}
        </PageFiltersContainer>
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

export default withPageFilters(AlertRulesListContainer);

const StyledLayoutBody = styled(Layout.Body)`
  margin-bottom: -20px;
`;

const StyledSortLink = styled(Link)`
  color: inherit;

  :hover {
    color: inherit;
  }
`;

const StyledPanelTable = styled(PanelTable)`
  position: static;
  overflow: auto;
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    overflow: initial;
  }

  grid-template-columns: 4fr auto 140px 60px 110px auto;
  white-space: nowrap;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const EmptyStateAction = styled('p')`
  font-size: ${p => p.theme.fontSizeLarge};
`;
