import {Component, Fragment} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import {Location} from 'history';
import moment from 'moment';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {Client, ResponseMeta} from 'sentry/api';
import Alert from 'sentry/components/alert';
import DateTime from 'sentry/components/dateTime';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {DateString, Organization} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import withApi from 'sentry/utils/withApi';
import {
  IncidentRule,
  TimePeriod,
  TimeWindow,
} from 'sentry/views/alerts/incidentRules/types';
import {makeRuleDetailsQuery} from 'sentry/views/alerts/list/row';

import {Incident} from '../../types';
import {fetchAlertRule, fetchIncident, fetchIncidentsForRule} from '../../utils';

import DetailsBody from './body';
import {TIME_OPTIONS, TIME_WINDOWS, TimePeriodType} from './constants';
import DetailsHeader from './header';

type Props = {
  api: Client;
  organization: Organization;
  location: Location;
} & RouteComponentProps<{ruleId: string; orgId: string}, {}>;

type State = {
  isLoading: boolean;
  hasError: boolean;
  error: ResponseMeta | null;
  rule?: IncidentRule;
  incidents?: Incident[];
  selectedIncident?: Incident | null;
};

class AlertRuleDetails extends Component<Props, State> {
  state: State = {isLoading: false, hasError: false, error: null};

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

    trackAnalyticsEvent({
      eventKey: 'alert_rule_details.viewed',
      eventName: 'Alert Rule Details: Viewed',
      organization_id: organization.id,
      rule_id: parseInt(params.ruleId, 10),
      alert: location.query.alert ?? '',
    });
  }

  getTimePeriod(): TimePeriodType {
    const {location} = this.props;
    const {rule} = this.state;

    const defaultPeriod =
      rule?.timeWindow && rule?.timeWindow > TimeWindow.ONE_HOUR
        ? TimePeriod.SEVEN_DAYS
        : TimePeriod.ONE_DAY;
    const period = location.query.period ?? defaultPeriod;

    if (location.query.start && location.query.end) {
      return {
        start: location.query.start,
        end: location.query.end,
        period,
        label: t('Custom time'),
        display: (
          <Fragment>
            <DateTime date={moment.utc(location.query.start)} timeAndDate />
            {' — '}
            <DateTime date={moment.utc(location.query.end)} timeAndDate />
          </Fragment>
        ),
        custom: true,
      };
    }

    if (location.query.alert && this.state.selectedIncident) {
      const {start, end} = makeRuleDetailsQuery(this.state.selectedIncident);
      return {
        start,
        end,
        period,
        label: t('Custom time'),
        display: (
          <Fragment>
            <DateTime date={moment.utc(start)} timeAndDate />
            {' — '}
            <DateTime date={moment.utc(end)} timeAndDate />
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

    if (location.query.alert) {
      await fetchIncident(api, orgId, location.query.alert)
        .then(incident => this.setState({selectedIncident: incident}))
        .catch(() => this.setState({selectedIncident: null}));
    } else {
      this.setState({selectedIncident: null});
    }

    try {
      const rule = await fetchAlertRule(orgId, ruleId);
      this.setState({rule});

      const timePeriod = this.getTimePeriod();
      const {start, end} = timePeriod;

      const incidents = await fetchIncidentsForRule(orgId, ruleId, start, end);
      this.setState({incidents});

      this.setState({isLoading: false, hasError: false});
    } catch (error) {
      this.setState({isLoading: false, hasError: true, error});
    }
  };

  handleTimePeriodChange = (value: string) => {
    browserHistory.push({
      pathname: this.props.location.pathname,
      query: {
        period: value,
      },
    });
  };

  handleZoom = (start: DateString, end: DateString) => {
    const {location} = this.props;
    browserHistory.push({
      pathname: location.pathname,
      query: {
        start,
        end,
      },
    });
  };

  renderError() {
    const {error} = this.state;

    return (
      <PageContent>
        <Alert type="error" icon={<IconWarning />}>
          {error?.status === 404
            ? t('This alert rule could not be found.')
            : t('An error occurred while fetching the alert rule.')}
        </Alert>
      </PageContent>
    );
  }

  render() {
    const {rule, incidents, hasError, selectedIncident} = this.state;
    const {params} = this.props;
    const timePeriod = this.getTimePeriod();

    if (hasError) {
      return this.renderError();
    }

    return (
      <Fragment>
        <DetailsHeader
          hasIncidentRuleDetailsError={hasError}
          params={params}
          rule={rule}
        />
        <DetailsBody
          {...this.props}
          rule={rule}
          incidents={incidents}
          timePeriod={timePeriod}
          selectedIncident={selectedIncident}
          handleTimePeriodChange={this.handleTimePeriodChange}
          handleZoom={this.handleZoom}
        />
      </Fragment>
    );
  }
}

export default withApi(AlertRuleDetails);
