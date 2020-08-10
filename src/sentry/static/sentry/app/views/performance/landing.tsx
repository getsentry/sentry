import React from 'react';
import {Location} from 'history';
import * as ReactRouter from 'react-router';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {Client} from 'app/api';
import {t} from 'app/locale';
import {GlobalSelection, Organization, Project} from 'app/types';
import {loadOrganizationTags} from 'app/actionCreators/tags';
import SearchBar from 'app/views/events/searchBar';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {PageContent} from 'app/styles/organization';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import Alert from 'app/components/alert';
import EventView from 'app/utils/discover/eventView';
import space from 'app/styles/space';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {IconFlag} from 'app/icons';
import {decodeScalar} from 'app/utils/queryString';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';
import {tokenizeSearch, stringifyQueryObject} from 'app/utils/tokenizeSearch';

import {generatePerformanceEventView, DEFAULT_STATS_PERIOD} from './data';
import Table from './table';
import Charts from './charts/index';
import Onboarding from './onboarding';

enum FilterViews {
  ALL_TRANSACTIONS = 'ALL_TRANSACTIONS',
  KEY_TRANSACTIONS = 'KEY_TRANSACTIONS',
}

const VIEWS = Object.values(FilterViews);

type Props = {
  api: Client;
  organization: Organization;
  selection: GlobalSelection;
  location: Location;
  router: ReactRouter.InjectedRouter;
  projects: Project[];
  loadingProjects: boolean;
  demoMode?: boolean;
};

type State = {
  eventView: EventView;
  error: string | undefined;
};

class PerformanceLanding extends React.Component<Props, State> {
  static getDerivedStateFromProps(nextProps: Props, prevState: State): State {
    return {
      ...prevState,
      eventView: generatePerformanceEventView(nextProps.organization, nextProps.location),
    };
  }

  state: State = {
    eventView: generatePerformanceEventView(this.props.organization, this.props.location),
    error: undefined,
  };

  componentDidMount() {
    const {api, organization, selection} = this.props;
    loadOrganizationTags(api, organization.slug, selection);
    trackAnalyticsEvent({
      eventKey: 'performance_views.overview.view',
      eventName: 'Performance Views: Transaction overview view',
      organization_id: parseInt(organization.id, 10),
    });
  }

  componentDidUpdate(prevProps: Props) {
    const {api, organization, selection} = this.props;
    if (
      !isEqual(prevProps.selection.projects, selection.projects) ||
      !isEqual(prevProps.selection.datetime, selection.datetime)
    ) {
      loadOrganizationTags(api, organization.slug, selection);
    }
  }

  renderError() {
    const {error} = this.state;

    if (!error) {
      return null;
    }

    return (
      <Alert type="error" icon={<IconFlag size="md" />}>
        {error}
      </Alert>
    );
  }

  setError = (error: string | undefined) => {
    this.setState({error});
  };

  handleSearch = (searchQuery: string) => {
    const {location, organization} = this.props;

    trackAnalyticsEvent({
      eventKey: 'performance_views.overview.search',
      eventName: 'Performance Views: Transaction overview search',
      organization_id: parseInt(organization.id, 10),
    });

    ReactRouter.browserHistory.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        cursor: undefined,
        query: String(searchQuery).trim() || undefined,
      },
    });
  };

  getViewLabel(currentView: FilterViews): string {
    switch (currentView) {
      case FilterViews.ALL_TRANSACTIONS:
        return t('By Transaction');
      case FilterViews.KEY_TRANSACTIONS:
        return t('By Key Transaction');
      default:
        throw Error(`Unknown view: ${currentView}`);
    }
  }

  getTransactionSearchQuery() {
    const {location} = this.props;

    return String(decodeScalar(location.query.query) || '').trim();
  }

  /**
   * Generate conditions to foward to the summary views.
   *
   * We drop the bare text string as in this view we apply it to
   * the transaction name, and that condition is redundant in the
   * summary view.
   */
  getSummaryConditions(query: string) {
    const parsed = tokenizeSearch(query);
    parsed.query = [];

    return stringifyQueryObject(parsed);
  }

  getCurrentView(): string {
    const {location} = this.props;
    const currentView = location.query.view as FilterViews;
    if (Object.values(FilterViews).includes(currentView)) {
      return currentView;
    }
    return FilterViews.ALL_TRANSACTIONS;
  }

  handleViewChange(viewKey: FilterViews) {
    const {location} = this.props;

    ReactRouter.browserHistory.push({
      pathname: location.pathname,
      query: {...location.query, view: viewKey},
    });
  }

  renderHeaderButtons() {
    return (
      <ButtonBar merged active={this.getCurrentView()}>
        {VIEWS.map(viewKey => {
          return (
            <Button
              key={viewKey}
              barId={viewKey}
              size="small"
              onClick={() => this.handleViewChange(viewKey)}
            >
              {this.getViewLabel(viewKey)}
            </Button>
          );
        })}
      </ButtonBar>
    );
  }

  shouldShowOnboarding() {
    const {projects, demoMode} = this.props;
    const {eventView} = this.state;

    // XXX used by getsentry to bypass onboarding for the upsell demo state.
    if (demoMode) {
      return false;
    }

    if (projects.length === 0) {
      return false;
    }

    // Current selection is 'my projects' or 'all projects'
    if (eventView.project.length === 0 || eventView.project === [ALL_ACCESS_PROJECTS]) {
      return (
        projects.filter(p => p.firstTransactionEvent === false).length === projects.length
      );
    }

    // Any other subset of projects.
    return (
      projects.filter(
        p =>
          eventView.project.includes(parseInt(p.id, 10)) &&
          p.firstTransactionEvent === false
      ).length === eventView.project.length
    );
  }

  render() {
    const {organization, location, router, projects} = this.props;
    const {eventView} = this.state;
    const showOnboarding = this.shouldShowOnboarding();
    const filterString = this.getTransactionSearchQuery();
    const summaryConditions = this.getSummaryConditions(filterString);
    const currentView = this.getCurrentView();

    return (
      <SentryDocumentTitle title={t('Performance')} objSlug={organization.slug}>
        <GlobalSelectionHeader
          defaultSelection={{
            datetime: {
              start: null,
              end: null,
              utc: false,
              period: DEFAULT_STATS_PERIOD,
            },
          }}
        >
          <PageContent>
            <LightWeightNoProjectMessage organization={organization}>
              <StyledPageHeader>
                <div>{t('Performance')}</div>
                {!showOnboarding && <div>{this.renderHeaderButtons()}</div>}
              </StyledPageHeader>
              {this.renderError()}
              {showOnboarding ? (
                <Onboarding />
              ) : (
                <div>
                  <StyledSearchBar
                    organization={organization}
                    projectIds={eventView.project}
                    query={filterString}
                    fields={eventView.fields}
                    onSearch={this.handleSearch}
                  />
                  <Charts
                    eventView={eventView}
                    organization={organization}
                    location={location}
                    router={router}
                    keyTransactions={currentView === 'KEY_TRANSACTIONS'}
                  />
                  <Table
                    eventView={eventView}
                    projects={projects}
                    organization={organization}
                    location={location}
                    setError={this.setError}
                    keyTransactions={currentView === 'KEY_TRANSACTIONS'}
                    summaryConditions={summaryConditions}
                  />
                </div>
              )}
            </LightWeightNoProjectMessage>
          </PageContent>
        </GlobalSelectionHeader>
      </SentryDocumentTitle>
    );
  }
}

export const StyledPageHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: ${p => p.theme.headerFontSize};
  color: ${p => p.theme.gray700};
  height: 40px;
  margin-bottom: ${space(1)};
`;

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;

  margin-bottom: ${space(2)};
`;

export default withApi(
  withOrganization(withProjects(withGlobalSelection(PerformanceLanding)))
);
