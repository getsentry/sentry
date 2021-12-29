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

import {DashboardListItem} from '../types';

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
  organization: Organization;
  location: Location;
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
          <TemplateCard title="Default" widgetCount={10} />
          <TemplateCard title="Frontend" widgetCount={9} />
          <TemplateCard title="Backend" widgetCount={13} />
          <TemplateCard title="Mobile" widgetCount={4} />
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
                  {t('Dashboards')}
                  <ButtonContainer>
                    <Feature
                      organization={organization}
                      features={['dashboards-template']}
                    >
                      <SwitchContainer>
                        {t('Show Templates')}
                        <TemplateSwitch
                          isActive={showTemplates}
                          size="lg"
                          toggle={this.toggleTemplates}
                        />
                      </SwitchContainer>
                    </Feature>
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
                  </ButtonContainer>
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

const SwitchContainer = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  display: inline;
  padding-right: ${space(2)};
`;

const TemplateSwitch = styled(Switch)`
  vertical-align: middle;
  display: inline;
  margin-left: ${space(1)};
`;

const ButtonContainer = styled('div')`
  display: inline;
`;

const TemplateContainer = styled('div')`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  @media (max-width: ${p => p.theme.breakpoints[3]}) {
    grid-template-columns: repeat(2, 1fr);
  }
  grid-gap: ${space(2)};
  padding-bottom: ${space(4)};
`;

export default withApi(withOrganization(ManageDashboards));
