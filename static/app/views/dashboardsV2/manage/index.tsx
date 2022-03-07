import {browserHistory, InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import {createDashboard} from 'sentry/actionCreators/dashboards';
import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import DropdownControl, {DropdownItem} from 'sentry/components/dropdownControl';
import {Title} from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import Switch from 'sentry/components/switchButton';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {Organization, SelectValue} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {decodeScalar} from 'sentry/utils/queryString';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';

import {DASHBOARDS_TEMPLATES} from '../data';
import {assignDefaultLayout, getInitialColumnDepths} from '../layoutUtils';
import {DashboardDetails, DashboardListItem} from '../types';

import DashboardList from './dashboardList';
import TemplateCard from './templateCard';
import {setShowTemplates, shouldShowTemplates} from './utils';

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
  location: Location;
  organization: Organization;
  router: InjectedRouter;
} & AsyncView['props'];

type State = {
  dashboards: DashboardListItem[] | null;
  dashboardsPageLinks: string;
  showTemplates: boolean;
} & AsyncView['state'];

class ManageDashboards extends AsyncView<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      showTemplates: shouldShowTemplates(),
    };
  }

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
    const {location, router, organization} = this.props;
    trackAdvancedAnalyticsEvent('dashboards_manage.search', {
      organization,
    });

    router.push({
      pathname: location.pathname,
      query: {...location.query, cursor: undefined, query},
    });
  }

  handleSortChange = (value: string) => {
    const {location, organization} = this.props;
    trackAdvancedAnalyticsEvent('dashboards_manage.change_sort', {
      organization,
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

  toggleTemplates = () => {
    const {showTemplates} = this.state;
    const {organization} = this.props;

    trackAdvancedAnalyticsEvent('dashboards_manage.templates.toggle', {
      organization,
      show_templates: !showTemplates,
    });

    this.setState({showTemplates: !showTemplates}, () => {
      setShowTemplates(!showTemplates);
    });
  };

  getQuery() {
    const {query} = this.props.location.query;

    return typeof query === 'string' ? query : undefined;
  }

  renderTemplates() {
    const {organization} = this.props;
    return (
      <Feature organization={organization} features={['dashboards-template']}>
        <TemplateContainer>
          {DASHBOARDS_TEMPLATES.map(dashboard => (
            <TemplateCard
              title={dashboard.title}
              description={dashboard.description}
              onPreview={() => this.onPreview(dashboard.id)}
              onAdd={() => this.onAdd(dashboard)}
              key={dashboard.title}
            />
          ))}
        </TemplateContainer>
      </Feature>
    );
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
    trackAdvancedAnalyticsEvent('dashboards_manage.create.start', {
      organization,
    });

    browserHistory.push({
      pathname: `/organizations/${organization.slug}/dashboards/new/`,
      query: location.query,
    });
  }

  async onAdd(dashboard: DashboardDetails) {
    const {organization, api} = this.props;
    trackAdvancedAnalyticsEvent('dashboards_manage.templates.add', {
      organization,
      dashboard_id: dashboard.id,
      dashboard_title: dashboard.title,
      was_previewed: false,
    });

    await createDashboard(
      api,
      organization.slug,
      {
        ...dashboard,
        widgets: assignDefaultLayout(dashboard.widgets, getInitialColumnDepths()),
      },
      true
    );
    this.onDashboardsChange();
    addSuccessMessage(`${dashboard.title} dashboard template successfully added.`);
  }

  onPreview(dashboardId: string) {
    const {organization, location} = this.props;
    trackAdvancedAnalyticsEvent('dashboards_manage.templates.preview', {
      organization,
      dashboard_id: dashboardId,
    });

    browserHistory.push({
      pathname: `/organizations/${organization.slug}/dashboards/new/${dashboardId}`,
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
    const {showTemplates} = this.state;
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
                  <Title>{t('Dashboards')}</Title>
                  <ButtonBar gap={1.5}>
                    <Feature
                      organization={organization}
                      features={['dashboards-template']}
                    >
                      <TemplateSwitch>
                        {t('Show Templates')}
                        <Switch
                          isActive={showTemplates}
                          size="lg"
                          toggle={this.toggleTemplates}
                        />
                      </TemplateSwitch>
                    </Feature>
                    <Button
                      data-test-id="dashboard-create"
                      onClick={event => {
                        event.preventDefault();
                        this.onCreate();
                      }}
                      priority="primary"
                      icon={<IconAdd isCircled />}
                    >
                      {t('Create Dashboard')}
                    </Button>
                  </ButtonBar>
                </StyledPageHeader>
                {showTemplates && this.renderTemplates()}
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
  justify-content: space-between;
  margin-bottom: ${space(2)};
`;

const StyledActions = styled('div')`
  display: grid;
  grid-template-columns: auto max-content;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: auto;
  }
`;

const TemplateSwitch = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  display: grid;
  align-items: center;
  grid-auto-flow: column;
  gap: ${space(1)};
  width: max-content;
`;

const TemplateContainer = styled('div')`
  display: grid;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: repeat(2, minmax(200px, 1fr));
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: repeat(4, minmax(200px, 1fr));
  }
`;

export default withApi(withOrganization(ManageDashboards));
