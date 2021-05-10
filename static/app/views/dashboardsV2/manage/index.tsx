import * as ReactRouter from 'react-router';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import Breadcrumbs from 'app/components/breadcrumbs';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import * as Layout from 'app/components/layouts/thirds';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import SearchBar from 'app/components/searchBar';
import {IconAdd} from 'app/icons';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import space from 'app/styles/space';
import {Organization, SelectValue} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {decodeScalar} from 'app/utils/queryString';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import AsyncView from 'app/views/asyncView';

import {DashboardListItem} from '../types';

import DashboardList from './dashboardList';

const SORT_OPTIONS: SelectValue<string>[] = [
  {label: t('My Dashboards'), value: 'mydashboards'},
  {label: t('Dashboard Name (A-Z)'), value: 'title'},
  {label: t('Date Created (Newest)'), value: '-dateCreated'},
  {label: t('Date Created (Oldest)'), value: 'dateCreated'},
];

type Props = {
  api: Client;
  organization: Organization;
  location: Location;
  router: ReactRouter.InjectedRouter;
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
        <StyledSearchBar
          defaultQuery=""
          query={this.getQuery()}
          placeholder={t('Search Dashboards')}
          onSearch={query => this.handleSearch(query)}
        />
        <StyledDropdownControl
          buttonProps={{prefix: t('Sort By')}}
          label={activeSort.label}
        >
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
        </StyledDropdownControl>
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
    return t('Manage Dashboards');
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

  renderBody() {
    const {organization} = this.props;

    return (
      <Feature
        organization={organization}
        features={['dashboards-manage']}
        renderDisabled={this.renderNoAccess}
      >
        <LightWeightNoProjectMessage organization={organization}>
          <Layout.Header>
            <Layout.HeaderContent>
              <Breadcrumbs
                crumbs={[
                  {
                    label: t('Dashboards'),
                    to: `/organizations/${organization.slug}/dashboards/`,
                  },
                  {
                    label: t('Manage Dashboards'),
                  },
                ]}
              />
              <Layout.Title>{t('Manage Dashboards')}</Layout.Title>
            </Layout.HeaderContent>

            <Layout.HeaderActions>
              <ButtonBar gap={1}>
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
              </ButtonBar>
            </Layout.HeaderActions>
          </Layout.Header>
          <Layout.Body>
            <Layout.Main fullWidth>
              {this.renderActions()}
              {this.renderDashboards()}
            </Layout.Main>
          </Layout.Body>
        </LightWeightNoProjectMessage>
      </Feature>
    );
  }
}

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
  margin-right: ${space(2)};
  margin-bottom: ${space(2)};
`;

const StyledDropdownControl = styled(DropdownControl)`
  margin-bottom: ${space(2)};
`;

const StyledActions = styled('div')`
  display: grid;
  grid-template-columns: auto max-content min-content;
  width: 100%;

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: auto;
  }

  margin-bottom: ${space(1)};
  align-items: center;
`;

export default withApi(withOrganization(ManageDashboards));
