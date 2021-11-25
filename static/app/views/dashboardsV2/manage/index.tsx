import {browserHistory, InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import DropdownControl, {DropdownItem} from 'sentry/components/dropdownControl';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {Organization, SelectValue} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import {decodeScalar} from 'sentry/utils/queryString';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';

import {DashboardListItem} from '../types';

import DashboardList from './dashboardList';

const SORT_OPTIONS: SelectValue<string>[] = [
  {label: t('My Dashboards'), value: 'mydashboards'},
  {label: t('Dashboard Name (A-Z)'), value: 'title'},
  {label: t('Date Created (Newest)'), value: '-dateCreated'},
  {label: t('Date Created (Oldest)'), value: 'dateCreated'},
  {label: t('Most Popular'), value: 'mostPopular'},
  {label: t('Recently Viewed'), value: 'recentlyViewed'},
];

type Props = {
  api: Client;
  organization: Organization;
  location: Location;
  router: InjectedRouter;
} & AsyncView['props'];

type State = {
  dashboards: DashboardListItem[] | null;
  dashboardsPageLinks: string;
} & AsyncView['state'];

class ManageDashboards extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {organization, location} = this.props;
    return [
      [
        'dashboards',
        `/organizations/${organization.slug}/dashboards/`,
        {
          query: {
            ...pick(location.query, ['cursor', 'query']),
            sort: this.getActiveSort().value,
            per_page: '9',
          },
        },
      ],
    ];
  }

  getActiveSort() {
    const {location} = this.props;

    const urlSort = decodeScalar(location.query.sort, 'mydashboards');
    return SORT_OPTIONS.find(item => item.value === urlSort) || SORT_OPTIONS[0];
  }

  onDashboardsChange() {
    this.reloadData();
  }

  handleSearch(query: string) {
    const {location, router} = this.props;
    trackAnalyticsEvent({
      eventKey: 'dashboards_manage.search',
      eventName: 'Dashboards Manager: Search',
      organization_id: parseInt(this.props.organization.id, 10),
    });

    router.push({
      pathname: location.pathname,
      query: {...location.query, cursor: undefined, query},
    });
  }

  handleSortChange = (value: string) => {
    const {location} = this.props;
    trackAnalyticsEvent({
      eventKey: 'dashboards_manage.change_sort',
      eventName: 'Dashboards Manager: Sort By Changed',
      organization_id: parseInt(this.props.organization.id, 10),
      sort: value,
    });
    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        cursor: undefined,
        sort: value,
      },
    });
  };

  getQuery() {
    const {query} = this.props.location.query;

    return typeof query === 'string' ? query : undefined;
  }

  renderActions() {
    const activeSort = this.getActiveSort();

    return (
      <StyledActions>
        <SearchBar
          defaultQuery=""
          query={this.getQuery()}
          placeholder={t('Search Dashboards')}
          onSearch={query => this.handleSearch(query)}
        />
        <DropdownControl buttonProps={{prefix: t('Sort By')}} label={activeSort.label}>
          {SORT_OPTIONS.map(({label, value}) => (
            <DropdownItem
              key={value}
              onSelect={this.handleSortChange}
              eventKey={value}
              isActive={value === activeSort.value}
            >
              {label}
            </DropdownItem>
          ))}
        </DropdownControl>
      </StyledActions>
    );
  }

  renderNoAccess() {
    return (
      <PageContent>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </PageContent>
    );
  }

  renderDashboards() {
    const {dashboards, dashboardsPageLinks} = this.state;
    const {organization, location, api} = this.props;
    return (
      <DashboardList
        api={api}
        dashboards={dashboards}
        organization={organization}
        pageLinks={dashboardsPageLinks}
        location={location}
        onDashboardsChange={() => this.onDashboardsChange()}
      />
    );
  }

  getTitle() {
    return t('Dashboards');
  }

  onCreate() {
    const {organization, location} = this.props;
    trackAnalyticsEvent({
      eventKey: 'dashboards_manage.create.start',
      eventName: 'Dashboards Manager: Dashboard Create Started',
      organization_id: parseInt(organization.id, 10),
    });
    browserHistory.push({
      pathname: `/organizations/${organization.slug}/dashboards/new/`,
      query: location.query,
    });
  }

  renderLoading() {
    return (
      <PageContent>
        <LoadingIndicator />
      </PageContent>
    );
  }

  renderBody() {
    const {organization} = this.props;

    return (
      <Feature
        organization={organization}
        features={['dashboards-edit']}
        renderDisabled={this.renderNoAccess}
      >
        <SentryDocumentTitle title={t('Dashboards')} orgSlug={organization.slug}>
          <StyledPageContent>
            <NoProjectMessage organization={organization}>
              <PageContent>
                <StyledPageHeader>
                  {t('Dashboards')}
                  <Button
                    data-test-id="dashboard-create"
                    onClick={event => {
                      event.preventDefault();
                      this.onCreate();
                    }}
                    priority="primary"
                    icon={<IconAdd size="xs" isCircled />}
                  >
                    {t('Create Dashboard')}
                  </Button>
                </StyledPageHeader>
                {this.renderActions()}
                {this.renderDashboards()}
              </PageContent>
            </NoProjectMessage>
          </StyledPageContent>
        </SentryDocumentTitle>
      </Feature>
    );
  }
}

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

const StyledPageHeader = styled('div')`
  display: flex;
  align-items: flex-end;
  font-size: ${p => p.theme.headerFontSize};
  color: ${p => p.theme.textColor};
  justify-content: space-between;
  margin-bottom: ${space(2)};
`;

const StyledActions = styled('div')`
  display: grid;
  grid-template-columns: auto max-content;
  grid-gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: auto;
  }
`;

export default withApi(withOrganization(ManageDashboards));
