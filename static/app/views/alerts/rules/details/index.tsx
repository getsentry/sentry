import {Component, Fragment} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import {Location} from 'history';
import moment from 'moment';

import {fetchOrgMembers} from 'app/actionCreators/members';
import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import DateTime from 'app/components/dateTime';
import {t} from 'app/locale';
import {DateString, Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {getUtcDateString} from 'app/utils/dates';
import withApi from 'app/utils/withApi';
import {IncidentRule, TimePeriod, TimeWindow} from 'app/views/alerts/incidentRules/types';
import {makeRuleDetailsQuery} from 'app/views/alerts/list/row';

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
  rule?: IncidentRule;
  incidents?: Incident[];
  selectedIncident?: Incident | null;
};

class AlertRuleDetails extends Component<Props, State> {
  state: State = {isLoading: false, hasError: false};

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

    const timePeriod = this.getTimePeriod();
    const {start, end} = timePeriod;

    try {
      const rulePromise = fetchAlertRule(orgId, ruleId).then(rule =>
        this.setState({rule})
      );
      const incidentsPromise = fetchIncidentsForRule(orgId, ruleId, start, end).then(
        incidents => this.setState({incidents})
      );
      await Promise.all([rulePromise, incidentsPromise]);
      this.setState({isLoading: false, hasError: false});
    } catch (_err) {
      this.setState({isLoading: false, hasError: true});
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

  handleZoom = async (start: DateString, end: DateString) => {
    const {location} = this.props;
    await browserHistory.push({
      pathname: location.pathname,
      query: {
        start,
        end,
      },
    });
  };

  render() {
    const {rule, incidents, hasError, selectedIncident} = this.state;
    const {params, organization} = this.props;
    const timePeriod = this.getTimePeriod();

    return (
      <Fragment>
        <Feature organization={organization} features={['alert-details-redesign']}>
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
        </Feature>
      </Fragment>
    );
  }
}

export default withApi(AlertRuleDetails);
