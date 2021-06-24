import {Component} from 'react';
import {browserHistory, InjectedRouter} from 'react-router';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';

import {loadOrganizationTags} from 'app/actionCreators/tags';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import GlobalSdkUpdateAlert from 'app/components/globalSdkUpdateAlert';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import PageHeading from 'app/components/pageHeading';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {IconFlag} from 'app/icons';
import {t} from 'app/locale';
import {PageContent, PageHeader} from 'app/styles/organization';
import {GlobalSelection, Organization, Project} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import EventView from 'app/utils/discover/eventView';
import {decodeScalar} from 'app/utils/queryString';
import {QueryResults, tokenizeSearch} from 'app/utils/tokenizeSearch';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

import LandingContent from './landing/content';
import {DEFAULT_MAX_DURATION} from './trends/utils';
import {DEFAULT_STATS_PERIOD, generatePerformanceEventView} from './data';
import Onboarding from './onboarding';
import {addRoutePerformanceContext, getPerformanceTrendsUrl} from './utils';

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

  handleTrendsClick() {
    const {location, organization} = this.props;

    const newQuery = {
      ...location.query,
    };

    const query = decodeScalar(location.query.query, '');
    const conditions = tokenizeSearch(query);

    trackAnalyticsEvent({
      eventKey: 'performance_views.change_view',
      eventName: 'Performance Views: Change View',
      organization_id: parseInt(organization.id, 10),
      view_name: 'TRENDS',
    });

    const modifiedConditions = new QueryResults([]);

    if (conditions.hasTag('tpm()')) {
      modifiedConditions.setTagValues('tpm()', conditions.getTagValues('tpm()'));
    } else {
      modifiedConditions.setTagValues('tpm()', ['>0.01']);
    }
    if (conditions.hasTag('transaction.duration')) {
      modifiedConditions.setTagValues(
        'transaction.duration',
        conditions.getTagValues('transaction.duration')
      );
    } else {
      modifiedConditions.setTagValues('transaction.duration', [
        '>0',
        `<${DEFAULT_MAX_DURATION}`,
      ]);
    }
    newQuery.query = modifiedConditions.formatString();

    browserHistory.push({
      pathname: getPerformanceTrendsUrl(organization),
      query: {...newQuery},
    });
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

  renderBody() {
    const {organization, projects} = this.props;
    const eventView = this.state.eventView;
    const showOnboarding = this.shouldShowOnboarding();

    return (
      <PageContent>
        <LightWeightNoProjectMessage organization={organization}>
          <PageHeader>
            <PageHeading>{t('Performance')}</PageHeading>
            {!showOnboarding && (
              <Button
                priority="primary"
                data-test-id="landing-header-trends"
                onClick={() => this.handleTrendsClick()}
              >
                {t('View Trends')}
              </Button>
            )}
          </PageHeader>
          <GlobalSdkUpdateAlert />
          {this.renderError()}
          {showOnboarding ? (
            <Onboarding organization={organization} />
          ) : (
            <LandingContent
              eventView={eventView}
              projects={projects}
              organization={organization}
              setError={this.setError}
              handleSearch={this.handleSearch}
            />
          )}
        </LightWeightNoProjectMessage>
      </PageContent>
    );
  }

  render() {
    const {organization} = this.props;

    return (
      <SentryDocumentTitle title={t('Performance')} orgSlug={organization.slug}>
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
          {this.renderBody()}
        </GlobalSelectionHeader>
      </SentryDocumentTitle>
    );
  }
}

export default withApi(
  withOrganization(withProjects(withGlobalSelection(PerformanceContent)))
);
