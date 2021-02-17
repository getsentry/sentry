import React from 'react';
import {Location} from 'history';
import {RouteComponentProps} from 'react-router';

import {fetchOrgMembers} from 'app/actionCreators/members';
import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import {Organization} from 'app/types';
import withApi from 'app/utils/withApi';
import {IncidentRule} from 'app/views/settings/incidentRules/types';

import {Incident} from '../../types';
import {fetchAlertRule, fetchIncidentsForRule} from '../../utils';

import DetailsBody, {ALERT_RULE_DETAILS_DEFAULT_PERIOD, getStartEndTimesFromPeriod} from './body';
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

  fetchData = async () => {
    const {location} = this.props;

    this.setState({isLoading: true, hasError: false});
    const {
      params: {orgId, ruleId},
    } = this.props;

    const {start, end} = getStartEndTimesFromPeriod(location.query.period ?? ALERT_RULE_DETAILS_DEFAULT_PERIOD);

    try {
      const rulePromise = fetchAlertRule(orgId, ruleId).then(rule =>
        this.setState({rule})
      );
      const incidentsPromise = fetchIncidentsForRule(orgId, ruleId, start, end).then(incidents =>
        this.setState({incidents})
      );
      await Promise.all([rulePromise, incidentsPromise]);
      this.setState({isLoading: false, hasError: false});
    } catch (_err) {
      this.setState({isLoading: false, hasError: true});
    }
  };

  render() {
    const {rule, incidents, hasError} = this.state;
    const {params, organization} = this.props;

    return (
      <React.Fragment>
        <Feature organization={organization} features={['alert-details-redesign']}>
          <DetailsHeader
            hasIncidentRuleDetailsError={hasError}
            params={params}
            rule={rule}
          />
          <DetailsBody {...this.props} rule={rule} incidents={incidents} />
        </Feature>
      </React.Fragment>
    );
  }
}

export default withApi(AlertRuleDetails);
