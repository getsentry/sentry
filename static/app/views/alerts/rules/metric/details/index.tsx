import {Component, Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import {Location} from 'history';
import moment from 'moment';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {Client, ResponseMeta} from 'sentry/api';
import Alert from 'sentry/components/alert';
import DateTime from 'sentry/components/dateTime';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {Organization, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {getUtcDateString} from 'sentry/utils/dates';
import withApi from 'sentry/utils/withApi';
import withProjects from 'sentry/utils/withProjects';
import {buildMetricGraphDateRange} from 'sentry/views/alerts/rules/details/utils';
import {MetricRule, TimePeriod} from 'sentry/views/alerts/rules/metric/types';
import type {Incident} from 'sentry/views/alerts/types';
import {
  fetchAlertRule,
  fetchIncident,
  fetchIncidentsForRule,
} from 'sentry/views/alerts/utils/apiCalls';

import DetailsBody from './body';
import {TIME_OPTIONS, TIME_WINDOWS, TimePeriodType} from './constants';
import DetailsHeader from './header';

interface Props extends RouteComponentProps<{orgId: string; ruleId: string}, {}> {
  api: Client;
  location: Location;
  organization: Organization;
  projects: Project[];
  loadingProjects?: boolean;
}

interface State {
  error: ResponseMeta | null;
  hasError: boolean;
  isLoading: boolean;
  selectedIncident: Incident | null;
  incidents?: Incident[];
  rule?: MetricRule;
}

class MetricAlertDetails extends Component<Props, State> {
  state: State = {isLoading: false, hasError: false, error: null, selectedIncident: null};

  componentDidMount() {
    const {api, params} = this.props;

    fetchOrgMembers(api, params.orgId);
    this.fetchData();
    this.trackView();
  }

  componentDidUpdate(prevProps: Props) {
    if (
      prevProps.location.search !== this.props.location.search ||
      prevProps.params.orgId !== this.props.params.orgId ||
      prevProps.params.ruleId !== this.props.params.ruleId
    ) {
      this.fetchData();
      this.trackView();
    }
  }

  trackView() {
    const {params, organization, location} = this.props;

    trackAdvancedAnalyticsEvent('alert_rule_details.viewed', {
      organization,
      rule_id: parseInt(params.ruleId, 10),
      alert: (location.query.alert as string) ?? '',
      has_chartcuterie: organization.features
        .includes('metric-alert-chartcuterie')
        .toString(),
    });
  }

  getTimePeriod(selectedIncident: Incident | null): TimePeriodType {
    const {location} = this.props;
    const period = (location.query.period as string) ?? TimePeriod.SEVEN_DAYS;

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
      TIME_OPTIONS.find(item => item.value === period) ?? TIME_OPTIONS[1];
    const start = getUtcDateString(
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

  fetchData = async () => {
    const {
      api,
      params: {orgId, ruleId},
      location,
    } = this.props;

    this.setState({isLoading: true, hasError: false});

    // Skip loading existing rule
    const rulePromise =
      ruleId === this.state.rule?.id
        ? Promise.resolve(this.state.rule)
        : fetchAlertRule(orgId, ruleId, {expand: 'latestIncident'});

    // Fetch selected incident, if it exists. We need this to set the selected date range
    let selectedIncident: Incident | null = null;
    if (location.query.alert) {
      try {
        selectedIncident = await fetchIncident(
          api,
          orgId,
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
        fetchIncidentsForRule(orgId, ruleId, start, end),
        rulePromise,
      ]);
      this.setState({
        incidents,
        rule,
        selectedIncident,
        isLoading: false,
        hasError: false,
      });
    } catch (error) {
      this.setState({selectedIncident, isLoading: false, hasError: true, error});
    }
  };

  renderError() {
    const {error} = this.state;

    return (
      <PageContent>
        <Alert type="error" showIcon>
          {error?.status === 404
            ? t('This alert rule could not be found.')
            : t('An error occurred while fetching the alert rule.')}
        </Alert>
      </PageContent>
    );
  }

  render() {
    const {rule, incidents, hasError, selectedIncident} = this.state;
    const {params, projects, loadingProjects} = this.props;
    const timePeriod = this.getTimePeriod(selectedIncident);

    if (hasError) {
      return this.renderError();
    }

    const project = projects.find(({slug}) => slug === rule?.projects[0]) as
      | Project
      | undefined;
    const isGlobalSelectionReady = project !== undefined && !loadingProjects;

    return (
      <PageFiltersContainer
        skipLoadLastUsed
        skipInitializeUrlParams
        isGlobalSelectionReady={isGlobalSelectionReady}
        shouldForceProject={isGlobalSelectionReady}
        forceProject={project}
        forceEnvironment={rule?.environment ?? ''}
        lockedMessageSubject={t('alert rule')}
        showDateSelector={false}
        hideGlobalHeader
      >
        <SentryDocumentTitle title={rule?.name ?? ''} />

        <DetailsHeader
          hasMetricRuleDetailsError={hasError}
          params={params}
          rule={rule}
          project={project}
        />
        <DetailsBody
          {...this.props}
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

export default withApi(withProjects(MetricAlertDetails));
