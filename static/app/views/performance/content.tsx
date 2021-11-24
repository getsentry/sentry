import {Component} from 'react';
import {browserHistory, InjectedRouter} from 'react-router';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';

import {loadOrganizationTags} from 'sentry/actionCreators/tags';
import {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import GlobalSdkUpdateAlert from 'sentry/components/globalSdkUpdateAlert';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import GlobalSelectionHeader from 'sentry/components/organizations/globalSelectionHeader';
import PageHeading from 'sentry/components/pageHeading';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/globalSelectionHeader';
import {IconFlag} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PageContent, PageHeader} from 'sentry/styles/organization';
import {GlobalSelection, Organization, Project} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {PerformanceEventViewProvider} from 'sentry/utils/performance/contexts/performanceEventViewContext';
import withApi from 'sentry/utils/withApi';
import withGlobalSelection from 'sentry/utils/withGlobalSelection';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';

import LandingContent from './landing/content';
import {DEFAULT_STATS_PERIOD, generatePerformanceEventView} from './data';
import {PerformanceLanding} from './landing';
import Onboarding from './onboarding';
import {addRoutePerformanceContext, handleTrendsClick} from './utils';

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

class PerformanceContent extends Component<Props, State> {
  static getDerivedStateFromProps(nextProps: Readonly<Props>, prevState: State): State {
    return {
      ...prevState,
      eventView: generatePerformanceEventView(
        nextProps.organization,
        nextProps.location,
        nextProps.projects
      ),
    };
  }

  state: State = {
    eventView: generatePerformanceEventView(
      this.props.organization,
      this.props.location,
      this.props.projects
    ),
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
      show_onboarding: this.shouldShowOnboarding(),
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

  renderBody() {
    const {organization, projects, selection} = this.props;
    const eventView = this.state.eventView;
    const showOnboarding = this.shouldShowOnboarding();

    return (
      <PageContent>
        <NoProjectMessage organization={organization}>
          <PageHeader>
            <PageHeading>{t('Performance')}</PageHeading>
            {!showOnboarding && (
              <Button
                priority="primary"
                data-test-id="landing-header-trends"
                onClick={() => handleTrendsClick(this.props)}
              >
                {t('View Trends')}
              </Button>
            )}
          </PageHeader>
          <GlobalSdkUpdateAlert />
          {this.renderError()}
          {showOnboarding ? (
            <Onboarding
              organization={organization}
              project={
                selection.projects.length > 0
                  ? // If some projects selected, use the first selection
                    projects.find(
                      project => selection.projects[0].toString() === project.id
                    ) || projects[0]
                  : // Otherwise, use the first project in the org
                    projects[0]
              }
            />
          ) : (
            <LandingContent
              eventView={eventView}
              projects={projects}
              organization={organization}
              setError={this.setError}
              handleSearch={this.handleSearch}
            />
          )}
        </NoProjectMessage>
      </PageContent>
    );
  }

  renderLandingV3() {
    return (
      <PerformanceLanding
        eventView={this.state.eventView}
        setError={this.setError}
        handleSearch={this.handleSearch}
        handleTrendsClick={() => handleTrendsClick(this.props)}
        shouldShowOnboarding={this.shouldShowOnboarding()}
        {...this.props}
      />
    );
  }

  render() {
    const {organization} = this.props;

    return (
      <SentryDocumentTitle title={t('Performance')} orgSlug={organization.slug}>
        <PerformanceEventViewProvider value={{eventView: this.state.eventView}}>
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
            <Feature features={['organizations:performance-landing-widgets']}>
              {({hasFeature}) =>
                hasFeature ? this.renderLandingV3() : this.renderBody()
              }
            </Feature>
          </GlobalSelectionHeader>
        </PerformanceEventViewProvider>
      </SentryDocumentTitle>
    );
  }
}

export default withApi(
  withOrganization(withProjects(withGlobalSelection(PerformanceContent)))
);
