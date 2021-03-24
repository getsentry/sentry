import React from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import {Location} from 'history';
import moment from 'moment';

import {fetchOrgMembers} from 'app/actionCreators/members';
import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import {getUtcDateString} from 'app/utils/dates';
import withApi from 'app/utils/withApi';
import {IncidentRule} from 'app/views/settings/incidentRules/types';

import {Incident} from '../../types';
import {fetchAlertRule, fetchIncidentsForRule} from '../../utils';

import DetailsBody from './body';
import {ALERT_RULE_DETAILS_DEFAULT_PERIOD, TIME_OPTIONS, TIME_WINDOWS} from './constants';
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
};

class AlertRuleDetails extends React.Component<Props, State> {
  state: State = {isLoading: false, hasError: false};

  componentDidMount() {
    const {api, params} = this.props;

    fetchOrgMembers(api, params.orgId);
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    if (
      prevProps.location.search !== this.props.location.search ||
      prevProps.params.orgId !== this.props.params.orgId ||
      prevProps.params.ruleId !== this.props.params.ruleId
    ) {
      this.fetchData();
    }
  }

  getTimePeriod() {
    const {location} = this.props;

    if (location.query.start && location.query.end) {
      return {
        start: location.query.start,
        end: location.query.end,
        label: t('Custom time'),
        custom: true,
      };
    }

    const timePeriod = location.query.period ?? ALERT_RULE_DETAILS_DEFAULT_PERIOD;
    const timeOption =
      TIME_OPTIONS.find(item => item.value === timePeriod) ?? TIME_OPTIONS[1];
    const start = getUtcDateString(
      moment(moment.utc().diff(TIME_WINDOWS[timeOption.value]))
    );
    const end = getUtcDateString(moment.utc());

    return {
      start,
      end,
      label: timeOption.label as string,
    };
  }

  fetchData = async () => {
    this.setState({isLoading: true, hasError: false});
    const {
      params: {orgId, ruleId},
    } = this.props;

    const timePeriod = this.getTimePeriod();
    const {start, end} = timePeriod;

    try {
      const rulePromise = fetchAlertRule(orgId, ruleId).then(rule =>
        this.setState({rule})
      );
      const incidentsPromise = fetchIncidentsForRule(
        orgId,
        ruleId,
        start,
        end
      ).then(incidents => this.setState({incidents}));
      await Promise.all([rulePromise, incidentsPromise]);
      this.setState({isLoading: false, hasError: false});
    } catch (_err) {
      this.setState({isLoading: false, hasError: true});
    }
  };

  handleTimePeriodChange = async (value: string) => {
    const {location} = this.props;
    await browserHistory.push({
      pathname: location.pathname,
      query: {
        period: value,
      },
    });
  };

  render() {
    const {rule, incidents, hasError} = this.state;
    const {params, organization} = this.props;
    const timePeriod = this.getTimePeriod();

    return (
      <React.Fragment>
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
            handleTimePeriodChange={this.handleTimePeriodChange}
          />
        </Feature>
      </React.Fragment>
    );
  }
}

export default withApi(AlertRuleDetails);
