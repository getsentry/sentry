import React from 'react';
import {Location} from 'history';
import {browserHistory, InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {Client} from 'app/api';
import {t} from 'app/locale';
import {GlobalSelection, Organization, Project} from 'app/types';
import {loadOrganizationTags} from 'app/actionCreators/tags';
import {updateDateTime} from 'app/actionCreators/globalSelection';
import SearchBar from 'app/views/events/searchBar';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {PageContent} from 'app/styles/organization';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import Alert from 'app/components/alert';
import Feature from 'app/components/acl/feature';
import EventView from 'app/utils/discover/eventView';
import space from 'app/styles/space';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {IconFlag} from 'app/icons';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';
import {
  tokenizeSearch,
  stringifyQueryObject,
  QueryResults,
} from 'app/utils/tokenizeSearch';
import {decodeScalar} from 'app/utils/queryString';

import {generatePerformanceEventView, DEFAULT_STATS_PERIOD} from './data';
import Table from './table';
import Charts from './charts/index';
import Onboarding from './onboarding';
import {addRoutePerformanceContext, getTransactionSearchQuery} from './utils';
import TrendsContent from './trends/content';
import {modifyTrendsViewDefaultPeriod, DEFAULT_TRENDS_STATS_PERIOD} from './trends/utils';

export enum FilterViews {
  ALL_TRANSACTIONS = 'ALL_TRANSACTIONS',
  KEY_TRANSACTIONS = 'KEY_TRANSACTIONS',
  TRENDS = 'TRENDS',
}

const VIEWS = Object.values(FilterViews).filter(view => view !== 'TRENDS');
const VIEWS_WITH_TRENDS = Object.values(FilterViews);

type Props = {
  api: Client;
  organization: Organization;
  selection: GlobalSelection;
  location: Location;
  router: InjectedRouter;
  projects: Project[];
  loadingProjects: boolean;
  demoMode?: boolean;
};

type State = {
  eventView: EventView;
  error: string | undefined;
};

function isStatsPeriodDefault(
  statsPeriod: string | undefined,
  defaultPeriod: string
): boolean {
  return !statsPeriod || defaultPeriod === statsPeriod;
}

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
    addRoutePerformanceContext(selection);
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
      addRoutePerformanceContext(selection);
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

    browserHistory.push({
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
      case FilterViews.TRENDS:
        return t('By Trends');
      default:
        throw Error(`Unknown view: ${currentView}`);
    }
  }

  /**
   * Generate conditions to forward to the summary views.
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
    const {location, organization} = this.props;

    const newQuery = {
      ...location.query,
    };

    const query = decodeScalar(location.query.query) || '';
    const statsPeriod = decodeScalar(location.query.statsPeriod);
    const conditions = tokenizeSearch(query);

    const currentView = location.query.view;

    const newDefaultPeriod =
      viewKey === FilterViews.TRENDS ? DEFAULT_TRENDS_STATS_PERIOD : DEFAULT_STATS_PERIOD;

    const hasStartAndEnd = newQuery.start && newQuery.end;

    if (!hasStartAndEnd && isStatsPeriodDefault(statsPeriod, newDefaultPeriod)) {
      /**
       * Resets stats period to default of the tab you are navigating to
       * on tab change as tabs have different default periods.
       */
      updateDateTime({
        start: null,
        end: null,
        utc: false,
        period: newDefaultPeriod,
      });
    }

    trackAnalyticsEvent({
      eventKey: 'performance_views.change_view',
      eventName: 'Performance Views: Change View',
      organization_id: parseInt(organization.id, 10),
      view_name: viewKey,
    });

    if (viewKey === FilterViews.TRENDS) {
      const modifiedConditions = new QueryResults([]);

      if (conditions.hasTag('count()')) {
        modifiedConditions.setTagValues('count()', conditions.getTagValues('count()'));
      } else {
        modifiedConditions.setTagValues('count()', ['>1000']);
      }
      if (conditions.hasTag('transaction.duration')) {
        modifiedConditions.setTagValues(
          'transaction.duration',
          conditions.getTagValues('transaction.duration')
        );
      } else {
        modifiedConditions.setTagValues('transaction.duration', ['>0']);
      }
      newQuery.query = stringifyQueryObject(modifiedConditions);
    }

    const isNavigatingAwayFromTrends = viewKey !== FilterViews.TRENDS && currentView;

    if (isNavigatingAwayFromTrends) {
      // This stops errors from occurring when navigating to other views since we are appending aggregates to the trends view
      conditions.removeTag('count()');
      conditions.removeTag('transaction.duration');

      newQuery.query = stringifyQueryObject(conditions);
    }

    browserHistory.push({
      pathname: location.pathname,
      query: {...newQuery, view: viewKey},
    });
  }

  renderHeaderButtons() {
    return (
      <Feature features={['trends']}>
        {({hasFeature}) =>
          hasFeature ? (
            <ButtonBar merged active={this.getCurrentView()}>
              {VIEWS_WITH_TRENDS.map(viewKey => {
                return (
                  <Button
                    key={viewKey}
                    barId={viewKey}
                    size="small"
                    data-test-id={'landing-header-' + viewKey.toLowerCase()}
                    onClick={() => this.handleViewChange(viewKey)}
                  >
                    {this.getViewLabel(viewKey)}
                  </Button>
                );
              })}
            </ButtonBar>
          ) : (
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
          )
        }
      </Feature>
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
    const currentView = this.getCurrentView();
    const isTrendsView = currentView === FilterViews.TRENDS;
    const eventView = isTrendsView
      ? modifyTrendsViewDefaultPeriod(this.state.eventView, location)
      : this.state.eventView;
    const showOnboarding = this.shouldShowOnboarding();
    const filterString = getTransactionSearchQuery(location);
    const summaryConditions = this.getSummaryConditions(filterString);

    return (
      <SentryDocumentTitle title={t('Performance')} objSlug={organization.slug}>
        <GlobalSelectionHeader
          defaultSelection={{
            datetime: {
              start: null,
              end: null,
              utc: false,
              period: isTrendsView ? DEFAULT_TRENDS_STATS_PERIOD : DEFAULT_STATS_PERIOD,
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
                <Onboarding organization={organization} />
              ) : currentView === FilterViews.TRENDS ? (
                <TrendsContent
                  organization={organization}
                  location={location}
                  eventView={eventView}
                />
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
                    keyTransactions={currentView === FilterViews.KEY_TRANSACTIONS}
                  />
                  <Table
                    eventView={eventView}
                    projects={projects}
                    organization={organization}
                    location={location}
                    setError={this.setError}
                    keyTransactions={currentView === FilterViews.KEY_TRANSACTIONS}
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
