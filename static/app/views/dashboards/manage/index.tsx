import {browserHistory, InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import pick from 'lodash/pick';

import {createDashboard} from 'sentry/actionCreators/dashboards';
import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openImportDashboardFromFileModal} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {CompactSelect} from 'sentry/components/compactSelect';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import Switch from 'sentry/components/switchButton';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, SelectValue} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar} from 'sentry/utils/queryString';
import withApi from 'sentry/utils/withApi';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import withOrganization from 'sentry/utils/withOrganization';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';

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
} & DeprecatedAsyncView['props'];

type State = {
  dashboards: DashboardListItem[] | null;
  dashboardsPageLinks: string;
  showTemplates: boolean;
} & DeprecatedAsyncView['state'];

class ManageDashboards extends DeprecatedAsyncView<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      showTemplates: shouldShowTemplates(),
    };
  }

  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    const {organization, location} = this.props;
    const endpoints: ReturnType<DeprecatedAsyncView['getEndpoints']> = [
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
    return endpoints;
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
    trackAnalytics('dashboards_manage.search', {
      organization,
    });

    router.push({
      pathname: location.pathname,
      query: {...location.query, cursor: undefined, query},
    });
  }

  handleSortChange = (value: string) => {
    const {location, organization} = this.props;
    trackAnalytics('dashboards_manage.change_sort', {
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

    trackAnalytics('dashboards_manage.templates.toggle', {
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
    return (
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
        <CompactSelect
          triggerProps={{prefix: t('Sort By')}}
          value={activeSort.value}
          options={SORT_OPTIONS}
          onChange={opt => this.handleSortChange(opt.value)}
          position="bottom-end"
        />
      </StyledActions>
    );
  }

  renderNoAccess() {
    return (
      <Layout.Page>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </Layout.Page>
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
    trackAnalytics('dashboards_manage.create.start', {
      organization,
    });

    browserHistory.push(
      normalizeUrl({
        pathname: `/organizations/${organization.slug}/dashboards/new/`,
        query: location.query,
      })
    );
  }

  async onAdd(dashboard: DashboardDetails) {
    const {organization, api} = this.props;
    trackAnalytics('dashboards_manage.templates.add', {
      organization,
      dashboard_id: dashboard.id,
      dashboard_title: dashboard.title,
      was_previewed: false,
    });

    const newDashboard = await createDashboard(
      api,
      organization.slug,
      {
        ...dashboard,
        widgets: assignDefaultLayout(dashboard.widgets, getInitialColumnDepths()),
      },
      true
    );
    addSuccessMessage(`${dashboard.title} dashboard template successfully added.`);
    this.loadDashboard(newDashboard.id);
  }

  loadDashboard(dashboardId: string) {
    const {organization, location} = this.props;
    browserHistory.push(
      normalizeUrl({
        pathname: `/organizations/${organization.slug}/dashboards/${dashboardId}/`,
        query: location.query,
      })
    );
  }

  onPreview(dashboardId: string) {
    const {organization, location} = this.props;
    trackAnalytics('dashboards_manage.templates.preview', {
      organization,
      dashboard_id: dashboardId,
    });

    browserHistory.push(
      normalizeUrl({
        pathname: `/organizations/${organization.slug}/dashboards/new/${dashboardId}/`,
        query: location.query,
      })
    );
  }

  renderLoading() {
    return (
      <Layout.Page withPadding>
        <LoadingIndicator />
      </Layout.Page>
    );
  }

  renderBody() {
    const {showTemplates} = this.state;
    const {organization, api, location} = this.props;

    return (
      <Feature
        organization={organization}
        features="dashboards-edit"
        renderDisabled={this.renderNoAccess}
      >
        <SentryDocumentTitle title={t('Dashboards')} orgSlug={organization.slug}>
          <Layout.Page>
            <NoProjectMessage organization={organization}>
              <Layout.Header>
                <Layout.HeaderContent>
                  <Layout.Title>
                    {t('Dashboards')}
                    <PageHeadingQuestionTooltip
                      docsUrl="https://docs.sentry.io/product/dashboards/"
                      title={t(
                        'A broad overview of your application’s health where you can navigate through error and performance data across multiple projects.'
                      )}
                    />
                  </Layout.Title>
                </Layout.HeaderContent>
                <Layout.HeaderActions>
                  <ButtonBar gap={1.5}>
                    <TemplateSwitch>
                      {t('Show Templates')}
                      <Switch
                        isActive={showTemplates}
                        size="lg"
                        toggle={this.toggleTemplates}
                      />
                    </TemplateSwitch>
                    <Button
                      data-test-id="dashboard-create"
                      onClick={event => {
                        event.preventDefault();
                        this.onCreate();
                      }}
                      size="sm"
                      priority="primary"
                      icon={<IconAdd isCircled />}
                    >
                      {t('Create Dashboard')}
                    </Button>
                    <Feature features="dashboards-import">
                      <Button
                        onClick={() => {
                          openImportDashboardFromFileModal({
                            organization,
                            api,
                            location,
                          });
                        }}
                        size="sm"
                        priority="primary"
                        icon={<IconAdd isCircled />}
                      >
                        {t('Import Dashboard from JSON')}
                      </Button>
                    </Feature>
                  </ButtonBar>
                </Layout.HeaderActions>
              </Layout.Header>
              <Layout.Body>
                <Layout.Main fullWidth>
                  {showTemplates && this.renderTemplates()}
                  {this.renderActions()}
                  {this.renderDashboards()}
                </Layout.Main>
              </Layout.Body>
            </NoProjectMessage>
          </Layout.Page>
        </SentryDocumentTitle>
      </Feature>
    );
  }
}

const StyledActions = styled('div')`
  display: grid;
  grid-template-columns: auto max-content;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: auto;
  }
`;

const TemplateSwitch = styled('label')`
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeLarge};
  display: flex;
  align-items: center;
  gap: ${space(1)};
  width: max-content;
  margin: 0;
`;

const TemplateContainer = styled('div')`
  display: grid;
  gap: ${space(2)};
  margin-bottom: ${space(0.5)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: repeat(2, minmax(200px, 1fr));
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: repeat(4, minmax(200px, 1fr));
  }
`;

export default withApi(withOrganization(ManageDashboards));
