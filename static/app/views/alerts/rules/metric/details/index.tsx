import {Component, Fragment} from 'react';
import type {Location} from 'history';
import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';
import moment from 'moment-timezone';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import type {Client} from 'sentry/api';
import {Alert} from 'sentry/components/core/alert';
import {DateTime} from 'sentry/components/dateTime';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';
import {
  AlertRuleComparisonType,
  TimePeriod,
} from 'sentry/views/alerts/rules/metric/types';
import type {Incident} from 'sentry/views/alerts/types';
import {
  fetchAlertRule,
  fetchIncident,
  fetchIncidentsForRule,
} from 'sentry/views/alerts/utils/apiCalls';

import MetricDetailsBody from './body';
import type {TimePeriodType} from './constants';
import {ALERT_RULE_STATUS, TIME_OPTIONS, TIME_WINDOWS} from './constants';
import DetailsHeader from './header';
import {buildMetricGraphDateRange} from './utils';

interface Props {
  api: Client;
  location: Location;
  organization: Organization;
  projects: Project[];
  ruleId: string;
  loadingProjects?: boolean;
}

interface State {
  error: RequestError | null;
  hasError: boolean;
  isLoading: boolean;
  selectedIncident: Incident | null;
  incidents?: Incident[];
  rule?: MetricRule;
  warning?: string;
}

class MetricAlertDetails extends Component<Props, State> {
  state: State = {
    isLoading: false,
    hasError: false,
    error: null,
    selectedIncident: null,
  };

  componentDidMount() {
    const {api, organization} = this.props;

    fetchOrgMembers(api, organization.slug);
    this.fetchData();
    this.trackView();
  }

  componentDidUpdate(prevProps: Props) {
    const prevQuery = pick(prevProps.location.query, ['start', 'end', 'period', 'alert']);
    const nextQuery = pick(this.props.location.query, [
      'start',
      'end',
      'period',
      'alert',
    ]);
    if (
      !isEqual(prevQuery, nextQuery) ||
      prevProps.organization.slug !== this.props.organization.slug ||
      prevProps.ruleId !== this.props.ruleId
    ) {
      this.fetchData();
      this.trackView();
    }
  }

  trackView() {
    const {ruleId, organization, location} = this.props;

    trackAnalytics('alert_rule_details.viewed', {
      organization,
      rule_id: parseInt(ruleId, 10),
      alert: (location.query.alert as string) ?? '',
      has_chartcuterie: organization.features
        .includes('metric-alert-chartcuterie')
        .toString(),
    });
  }

  getTimePeriod(selectedIncident: Incident | null): TimePeriodType {
    const {location} = this.props;
    const {rule} = this.state;
    let period = location.query.period as string | undefined;
    if (!period) {
      // Default to 28d view for dynamic alert rules! Anomaly detection
      // is evaluated against 28d of historical data, so incidents should
      // be presented in that same context for clarity
      if (rule?.detectionType === AlertRuleComparisonType.DYNAMIC) {
        period = TimePeriod.TWENTY_EIGHT_DAYS;
      } else {
        period = TimePeriod.SEVEN_DAYS;
      }
    }

    if (location.query.start && location.query.end) {
      return {
        start: location.query.start as string,
        end: location.query.end as string,
        period,
        usingPeriod: false,
        label: t('Custom time'),
        display: (
          <Fragment>
            <DateTime date={moment.utc(location.query.start)} />
            {' — '}
            <DateTime date={moment.utc(location.query.end)} />
          </Fragment>
        ),
        custom: true,
      };
    }

    if (location.query.alert && selectedIncident) {
      const {start, end} = buildMetricGraphDateRange(selectedIncident);
      return {
        start,
        end,
        period,
        usingPeriod: false,
        label: t('Custom time'),
        display: (
          <Fragment>
            <DateTime date={moment.utc(start)} />
            {' — '}
            <DateTime date={moment.utc(end)} />
          </Fragment>
        ),
        custom: true,
      };
    }

    const timeOption =
      TIME_OPTIONS.find(item => item.value === period) ?? TIME_OPTIONS[1]!;
    const start = getUtcDateString(
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      moment(moment.utc().diff(TIME_WINDOWS[timeOption.value]))
    );
    const end = getUtcDateString(moment.utc());

    return {
      start,
      end,
      period,
      usingPeriod: true,
      label: timeOption.label as string,
      display: timeOption.label as string,
    };
  }

  onSnooze = ({
    snooze,
    snoozeCreatedBy,
    snoozeForEveryone,
  }: {
    snooze: boolean;
    snoozeCreatedBy?: string;
    snoozeForEveryone?: boolean;
  }) => {
    if (this.state.rule) {
      const rule = {...this.state.rule, snooze, snoozeCreatedBy, snoozeForEveryone};
      this.setState({rule});
    }
  };

  fetchData = async () => {
    const {api, organization, ruleId, location} = this.props;

    this.setState({isLoading: true, hasError: false});

    // Skip loading existing rule
    const rulePromise =
      ruleId === this.state.rule?.id
        ? Promise.resolve(this.state.rule)
        : fetchAlertRule(organization.slug, ruleId, {expand: 'latestIncident'});

    // Fetch selected incident, if it exists. We need this to set the selected date range
    let selectedIncident: Incident | null = null;
    if (location.query.alert) {
      try {
        selectedIncident = await fetchIncident(
          api,
          organization.slug,
          location.query.alert as string
        );
      } catch {
        // TODO: selectedIncident specific error
      }
    }

    const timePeriod = this.getTimePeriod(selectedIncident);
    const {start, end} = timePeriod;
    try {
      const [incidents, rule] = await Promise.all([
        fetchIncidentsForRule(organization.slug, ruleId, start, end),
        rulePromise,
      ]);
      let warning: any;
      if (rule.status === ALERT_RULE_STATUS.NOT_ENOUGH_DATA) {
        warning =
          'Insufficient data for anomaly detection. This feature will enable automatically when more data is available.';
      }
      this.setState({
        incidents,
        rule,
        warning,
        selectedIncident,
        isLoading: false,
        hasError: false,
      });
    } catch (error) {
      this.setState({
        selectedIncident,
        isLoading: false,
        hasError: true,
        error: error as RequestError,
      });
    }
  };

  renderError() {
    const {error} = this.state;

    return (
      <Layout.Page withPadding>
        <Alert.Container>
          <Alert variant="danger">
            {error?.status === 404
              ? t('This alert rule could not be found.')
              : t('An error occurred while fetching the alert rule.')}
          </Alert>
        </Alert.Container>
      </Layout.Page>
    );
  }

  render() {
    const {rule, incidents, hasError, selectedIncident, warning} = this.state;
    const {organization, projects, loadingProjects} = this.props;
    const timePeriod = this.getTimePeriod(selectedIncident);

    if (hasError) {
      return this.renderError();
    }

    const project = projects.find(({slug}) => slug === rule?.projects[0]);
    const isGlobalSelectionReady = project !== undefined && !loadingProjects;

    return (
      <PageFiltersContainer
        skipLoadLastUsed
        skipInitializeUrlParams
        shouldForceProject={isGlobalSelectionReady}
        forceProject={project}
      >
        {warning && (
          <Alert.Container>
            <Alert variant="warning">{warning}</Alert>
          </Alert.Container>
        )}
        <SentryDocumentTitle title={rule?.name ?? ''} />

        <DetailsHeader
          hasMetricRuleDetailsError={hasError}
          organization={organization}
          rule={rule}
          project={project}
          onSnooze={this.onSnooze}
        />
        <MetricDetailsBody
          rule={rule}
          project={project}
          incidents={incidents}
          timePeriod={timePeriod}
          selectedIncident={selectedIncident}
        />
      </PageFiltersContainer>
    );
  }
}

export default function MetricAlertDetailsWrapper() {
  const api = useApi();
  const location = useLocation();
  const {ruleId} = useParams<{ruleId: string}>();
  const organization = useOrganization();
  const {projects, initiallyLoaded} = useProjects();

  return (
    <MetricAlertDetails
      api={api}
      location={location}
      organization={organization}
      ruleId={ruleId}
      projects={projects}
      loadingProjects={!initiallyLoaded}
    />
  );
}
