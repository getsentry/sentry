import {Component} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {addErrorMessage, addMessage} from 'sentry/actionCreators/indicator';
import AsyncComponent from 'sentry/components/asyncComponent';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization, PageFilters, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import Projects from 'sentry/utils/projects';
import Teams from 'sentry/utils/teams';
import withPageFilters from 'sentry/utils/withPageFilters';

import FilterBar from '../../filterBar';
import {AlertRuleType, CombinedMetricIssueAlerts} from '../../types';
import {getTeamParams, isIssueAlert} from '../../utils';
import AlertHeader from '../header';

import RuleListRow from './row';

type Props = RouteComponentProps<{orgId: string}, {}> & {
  organization: Organization;
  selection: PageFilters;
};

type State = {
  ruleList?: CombinedMetricIssueAlerts[] | null;
  teamFilterSearch?: string;
};

class AlertRulesList extends AsyncComponent<Props, State & AsyncComponent['state']> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {params, location} = this.props;
    const {query} = location;

    query.expand = ['latestIncident', 'lastTriggered'];
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

  get projectsFromResults() {
    const ruleList = this.state.ruleList ?? [];

    return [...new Set(ruleList.map(({projects}) => projects).flat())];
  }

  handleChangeFilter = (activeFilters: string[]) => {
    const {router, location} = this.props;
    const {cursor: _cursor, page: _page, ...currentQuery} = location.query;
    router.push({
      pathname: location.pathname,
      query: {
        ...currentQuery,
        team: activeFilters.length > 0 ? activeFilters : '',
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

  handleOwnerChange = (
    projectId: string,
    rule: CombinedMetricIssueAlerts,
    ownerValue: string
  ) => {
    const {orgId} = this.props.params;
    const alertPath = rule.type === 'alert_rule' ? 'alert-rules' : 'rules';
    const endpoint = `/projects/${orgId}/${projectId}/${alertPath}/${rule.id}/`;
    const updatedRule = {...rule, owner: ownerValue};

    this.api.request(endpoint, {
      method: 'PUT',
      data: updatedRule,
      success: () => {
        addMessage(t('Updated alert rule'), 'success');
      },
      error: () => {
        addMessage(t('Unable to save change'), 'error');
      },
    });
  };

  handleDeleteRule = async (projectId: string, rule: CombinedMetricIssueAlerts) => {
    const {orgId} = this.props.params;
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
    const hasEditAccess = organization.access.includes('alerts:write');

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
      <Layout.Body>
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
                  t('Actions'),
                ]}
                isLoading={loading || !loadedTeams}
                isEmpty={ruleList?.length === 0}
                emptyMessage={t('No alert rules found for the current query.')}
              >
                <Projects orgId={orgId} slugs={this.projectsFromResults}>
                  {({initiallyLoaded, projects}) =>
                    ruleList?.map(rule => (
                      <RuleListRow
                        // Metric and issue alerts can have the same id
                        key={`${
                          isIssueAlert(rule) ? AlertRuleType.METRIC : AlertRuleType.ISSUE
                        }-${rule.id}`}
                        projectsLoaded={initiallyLoaded}
                        projects={projects as Project[]}
                        rule={rule}
                        orgId={orgId}
                        onOwnerChange={this.handleOwnerChange}
                        onDelete={this.handleDeleteRule}
                        userTeams={new Set(teams.map(team => team.id))}
                        hasEditAccess={hasEditAccess}
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
      </Layout.Body>
    );
  }

  renderBody() {
    const {params, router} = this.props;
    const {orgId} = params;

    return (
      <SentryDocumentTitle title={t('Alerts')} orgSlug={orgId}>
        <PageFiltersContainer>
          <AlertHeader router={router} activeTab="rules" />
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

    trackAdvancedAnalyticsEvent('alert_rules.viewed', {
      organization,
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

const StyledSortLink = styled(Link)`
  color: inherit;

  :hover {
    color: inherit;
  }
`;

const StyledPanelTable = styled(PanelTable)`
  position: static;
  overflow: auto;
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    overflow: initial;
  }

  grid-template-columns: 4fr auto 140px 60px auto;
  white-space: nowrap;
  font-size: ${p => p.theme.fontSizeMedium};
`;
