import {Component} from 'react';

import {fetchOrganizationDetails} from 'sentry/actionCreators/organization';
import type {Client} from 'sentry/api';
import type {Organization} from 'sentry/types/organization';
import withApi from 'sentry/utils/withApi';

import withSubscription from 'getsentry/components/withSubscription';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {Subscription} from 'getsentry/types';
import trackMarketingEvent from 'getsentry/utils/trackMarketingEvent';

type ChildProps = {
  startTrial: () => Promise<void>;
  subscription: Subscription;
  trialFailed: boolean;
  trialStarted: boolean;
  trialStarting: boolean;
};
type Props = {
  api: Client;
  children: (args: ChildProps) => React.ReactNode;
  organization: Organization;
  source: string;
  subscription: Subscription;
  onTrialFailed?: (err: Error) => void;
  // Can't use default prop typings because of HoC wrappers.
  onTrialStarted?: () => void;
  requestData?: Record<string, unknown>;
};

type State = {
  trialFailed: boolean;
  trialStarted: boolean;
  trialStarting: boolean;
};

class TrialStarter extends Component<Props, State> {
  static defaultProps = {
    onTrialFailed: () => {},
    onTrialStarted: () => {},
  };

  state: State = {
    trialStarting: false,
    trialStarted: false,
    trialFailed: false,
  };

  handleStartTrial = async () => {
    const {organization, source, onTrialStarted, onTrialFailed, requestData} = this.props;
    this.setState({trialStarting: true});
    let data: any;
    let url: any;
    if (requestData) {
      data = {referrer: source, ...requestData};
      url = `/customers/${organization.slug}/product-trial/`;
    } else {
      data = {trial: true, referrer: source};
      url = `/customers/${organization.slug}/`;
    }

    try {
      await this.props.api.requestPromise(url, {
        method: 'PUT',
        data,
      });
    } catch (err) {
      onTrialFailed?.(err);
      this.setState({trialStarting: false, trialFailed: true});
      return;
    }

    this.setState({trialStarting: false, trialStarted: true});
    trackMarketingEvent('Start Trial');
    onTrialStarted?.();

    // Refresh organization and subscription state
    SubscriptionStore.loadData(organization.slug, null, {markStartedTrial: true});
    fetchOrganizationDetails(this.props.api, organization.slug, true);

    // we showed the "new" icon for the upsell that wasn't the actual dashboard
    // we should clear this so folks can see "new" for the actual dashboard
    localStorage.removeItem('sidebar-new-seen:customizable-dashboards');
  };

  render() {
    const {trialStarted, trialStarting, trialFailed} = this.state;
    const {subscription, children} = this.props;

    return children({
      startTrial: this.handleStartTrial,
      trialStarting,
      trialStarted,
      trialFailed,
      subscription,
    });
  }
}

// We enable the persistInFlight on the withApi wrapper to ensure that we don't
// cancel the in-flight requests to reload the organization details after the
// trial has been started. Otherwise if this component is unmounted as a result
// of starting the trial.
export default withSubscription(withApi(TrialStarter, {persistInFlight: true}));
