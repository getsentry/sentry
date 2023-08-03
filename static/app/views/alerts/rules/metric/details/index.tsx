import {Component, Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';
import moment from 'moment';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {Client, ResponseMeta} from 'sentry/api';
import {Alert} from 'sentry/components/alert';
import DateTime from 'sentry/components/dateTime';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import withApi from 'sentry/utils/withApi';
import withProjects from 'sentry/utils/withProjects';
import {MetricRule, TimePeriod} from 'sentry/views/alerts/rules/metric/types';
import type {Incident} from 'sentry/views/alerts/types';
import {
  fetchAlertRule,
  fetchIncident,
  fetchIncidentsForRule,
} from 'sentry/views/alerts/utils/apiCalls';

import MetricDetailsBody from './body';
import {TIME_OPTIONS, TIME_WINDOWS, TimePeriodType} from './constants';
import DetailsHeader from './header';
import {buildMetricGraphDateRange} from './utils';

interface Props extends RouteComponentProps<{ruleId: string}, {}> {
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
      prevProps.params.ruleId !== this.props.params.ruleId
    ) {
      this.fetchData();
      this.trackView();
    }
  }

  trackView() {
    const {params, organization, location} = this.props;

    trackAnalytics('alert_rule_details.viewed', {
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
    const {
      api,
      organization,
      params: {ruleId},
      location,
    } = this.props;

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
      <Layout.Page withPadding>
        <Alert type="error" showIcon>
          {error?.status === 404
            ? t('This alert rule could not be found.')
            : t('An error occurred while fetching the alert rule.')}
        </Alert>
      </Layout.Page>
    );
  }

  render() {
    const {rule, incidents, hasError, selectedIncident} = this.state;
    const {organization, projects, loadingProjects} = this.props;
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
        shouldForceProject={isGlobalSelectionReady}
        forceProject={project}
      >
        <SentryDocumentTitle title={rule?.name ?? ''} />

        <DetailsHeader
          hasMetricRuleDetailsError={hasError}
          organization={organization}
          rule={rule}
          project={project}
          onSnooze={this.onSnooze}
        />
        <MetricDetailsBody
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
