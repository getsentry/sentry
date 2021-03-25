import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import flatten from 'lodash/flatten';

import {addErrorMessage} from 'app/actionCreators/indicator';
import Feature from 'app/components/acl/feature';
import AsyncComponent from 'app/components/asyncComponent';
import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';
import * as Layout from 'app/components/layouts/thirds';
import ExternalLink from 'app/components/links/externalLink';
import Link from 'app/components/links/link';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import Pagination from 'app/components/pagination';
import {PanelTable, PanelTableHeader} from 'app/components/panels';
import SearchBar from 'app/components/searchBar';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {IconArrow, IconCheckmark} from 'app/icons';
import {t, tct} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {GlobalSelection, Organization, Project, Team} from 'app/types';
import {IssueAlertRule} from 'app/types/alerts';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import Projects from 'app/utils/projects';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withTeams from 'app/utils/withTeams';

import AlertHeader from '../list/header';
import {isIssueAlert} from '../utils';

import Filter from './filter';
import RuleListRow from './row';

const DEFAULT_SORT: {asc: boolean; field: 'date_added'} = {
  asc: false,
  field: 'date_added',
};
const DOCS_URL = 'https://docs.sentry.io/product/alerts-notifications/metric-alerts/';
const ALERT_LIST_QUERY_DEFAULT_TEAMS = ['myteams', 'unassigned'];

type Props = RouteComponentProps<{orgId: string}, {}> & {
  organization: Organization;
  selection: GlobalSelection;
  teams: Team[];
};

type State = {
  ruleList?: IssueAlertRule[];
};

class AlertRulesList extends AsyncComponent<Props, State & AsyncComponent['state']> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {params, location} = this.props;
    const {query} = location;

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

  tryRenderEmpty() {
    const {ruleList} = this.state;
    if (ruleList && ruleList.length > 0) {
      return null;
    }

    return (
      <React.Fragment>
        {
          <IconWrapper>
            <IconCheckmark isCircled size="48" />
          </IconWrapper>
        }
        {<Title>{t('No alert rules exist for these projects.')}</Title>}
        {
          <Description>
            {tct('Learn more about [link:Alerts]', {
              link: <ExternalLink href={DOCS_URL} />,
            })}
          </Description>
        }
      </React.Fragment>
    );
  }

  handleChangeFilter = (activeFilters: Set<string>) => {
    const {router, location} = this.props;
    router.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        team: [...activeFilters],
      },
    });
  };

  handleChangeSearch = (name: string) => {
    const {router, location} = this.props;
    router.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        name,
      },
    });
  };

  handleDeleteRule = async (projectId: string, rule: IssueAlertRule) => {
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
    const teamQuery = location.query?.team;
    const filteredTeams: Set<string> =
      typeof teamQuery === 'string' ? new Set([teamQuery]) : new Set(teamQuery);
    const additionalOptions = [
      {label: t('My Teams'), value: 'myteams'},
      {label: t('Unassigned'), value: 'unassigned'},
    ];
    const optionValues = [
      ...teams.map(({id}) => id),
      ...additionalOptions.map(({value}) => value),
    ];
    return (
      <FilterWrapper>
        <Filter
          header={t('Team')}
          onFilterChange={this.handleChangeFilter}
          filterList={optionValues}
          selection={filteredTeams}
        >
          {({toggleFilter}) => (
            <List>
              {additionalOptions.map(({label, value}) => (
                <ListItem
                  key={value}
                  isChecked={filteredTeams.has(value)}
                  onClick={event => {
                    event.stopPropagation();
                    toggleFilter(value);
                  }}
                >
                  <TeamName>{label}</TeamName>
                  <CheckboxFancy isChecked={filteredTeams.has(value)} />
                </ListItem>
              ))}
              {teams.map(({id, name}) => (
                <ListItem
                  key={id}
                  isChecked={filteredTeams.has(id)}
                  onClick={event => {
                    event.stopPropagation();
                    toggleFilter(id);
                  }}
                >
                  <TeamName>{name}</TeamName>
                  <CheckboxFancy isChecked={filteredTeams.has(id)} />
                </ListItem>
              ))}
            </List>
          )}
        </Filter>
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

    const sort = {
      ...DEFAULT_SORT,
      asc: query.asc === '1',
      // Currently only supported sorting field is 'date_added'
    };

    const userTeams = new Set(teams.filter(({isMember}) => isMember).map(({id}) => id));
    return (
      <StyledLayoutBody>
        <Layout.Main fullWidth>
          <Feature
            organization={organization}
            features={['organizations:team-alerts-ownership']}
          >
            {({hasFeature}) => (
              <React.Fragment>
                {hasFeature && this.renderFilterBar()}
                <StyledPanelTable
                  headers={[
                    t('Type'),
                    t('Alert Name'),
                    t('Project'),
                    ...(hasFeature ? [t('Team')] : []),
                    t('Created By'),
                    // eslint-disable-next-line react/jsx-key
                    <StyledSortLink
                      to={{
                        pathname: `/organizations/${orgId}/alerts/rules/`,
                        query: {
                          ...query,
                          asc: sort.asc ? undefined : '1',
                        },
                      }}
                    >
                      {t('Created')}{' '}
                      <IconArrow
                        color="gray300"
                        size="xs"
                        direction={sort.asc ? 'up' : 'down'}
                      />
                    </StyledSortLink>,
                    t('Actions'),
                  ]}
                  isLoading={loading}
                  isEmpty={ruleList?.length === 0}
                  emptyMessage={this.tryRenderEmpty()}
                  showTeamCol={hasFeature}
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
              </React.Fragment>
            )}
          </Feature>
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

class AlertRulesListContainer extends React.Component<Props> {
  componentDidMount() {
    const {organization, router, location, selection} = this.props;
    const query: Record<string, string | number | string[] | number[]> = {
      project: selection.projects,
      // TODO(workflow): Support environments from global selection header
      // environment: selection.environments,
    };

    if (organization.features.includes('team-alerts-ownership')) {
      query.team = ALERT_LIST_QUERY_DEFAULT_TEAMS;
    }

    router.replace({
      pathname: location.pathname,
      query: {
        ...query,
        ...location.query,
      },
    });
    this.trackView();
  }

  componentDidUpdate(nextProps: Props) {
    if (nextProps.location.query?.sort !== this.props.location.query?.sort) {
      this.trackView();
    }
  }

  trackView() {
    const {organization, location} = this.props;

    trackAnalyticsEvent({
      eventKey: 'alert_rules.viewed',
      eventName: 'Alert Rules: Viewed',
      organization_id: organization.id,
      sort: location.query.sort,
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

const TeamName = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  ${overflowEllipsis};
`;

const FilterWrapper = styled('div')`
  display: flex;
  margin-bottom: ${space(1.5)};
`;

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
  margin-left: ${space(1.5)};
`;

const List = styled('ul')`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const ListItem = styled('li')<{isChecked?: boolean}>`
  display: grid;
  grid-template-columns: 1fr max-content;
  grid-column-gap: ${space(1)};
  align-items: center;
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
  :hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }
  ${CheckboxFancy} {
    opacity: ${p => (p.isChecked ? 1 : 0.3)};
  }

  &:hover ${CheckboxFancy} {
    opacity: 1;
  }

  &:hover span {
    color: ${p => p.theme.blue300};
    text-decoration: underline;
  }
`;

const StyledPanelTable = styled(PanelTable)<{showTeamCol: boolean}>`
  ${PanelTableHeader} {
    line-height: normal;
  }
  font-size: ${p => p.theme.fontSizeMedium};
  grid-template-columns: auto 1.5fr 1fr 1fr 1fr ${p => (p.showTeamCol ? '1fr' : '')} auto;
  margin-bottom: 0;
  white-space: nowrap;
  ${p =>
    p.emptyMessage &&
    `svg:not([data-test-id='icon-check-mark']) {
    display: none;`}
`;

const IconWrapper = styled('span')`
  color: ${p => p.theme.gray200};
  display: block;
`;

const Title = styled('strong')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-bottom: ${space(1)};
`;

const Description = styled('span')`
  font-size: ${p => p.theme.fontSizeLarge};
  display: block;
  margin: 0;
`;
