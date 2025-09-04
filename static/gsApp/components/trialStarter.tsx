import {useState} from 'react';

import {fetchOrganizationDetails} from 'sentry/actionCreators/organization';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';

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
  children: (args: ChildProps) => React.ReactNode;
  organization: Organization;
  source: string;
  subscription: Subscription;
  onTrialFailed?: (err: Error) => void;
  // Can't use default prop typings because of HoC wrappers.
  onTrialStarted?: () => void;
  requestData?: Record<string, unknown>;
};

function TrialStarter(props: Props) {
  const api = useApi({persistInFlight: true});
  const [trialStarting, setTrialStarting] = useState(false);
  const [trialStarted, setTrialStarted] = useState(false);
  const [trialFailed, setTrialFailed] = useState(false);

  const handleStartTrial = async () => {
    const {organization, source, requestData} = props;
    setTrialStarting(true);
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
      await api.requestPromise(url, {
        method: 'PUT',
        data,
      });
    } catch (err) {
      props.onTrialFailed?.(err as Error);
      setTrialStarting(false);
      setTrialFailed(true);
      return;
    }

    setTrialStarting(false);
    setTrialStarted(true);
    trackMarketingEvent('Start Trial');
    props.onTrialStarted?.();

    // Refresh organization and subscription state
    SubscriptionStore.loadData(organization.slug, null, {markStartedTrial: true});
    fetchOrganizationDetails(api, organization.slug);

    // we showed the "new" icon for the upsell that wasn't the actual dashboard
    // we should clear this so folks can see "new" for the actual dashboard
    localStorage.removeItem('sidebar-new-seen:customizable-dashboards');
  };

  const {subscription, children} = props;

  return children({
    startTrial: handleStartTrial,
    trialStarting,
    trialStarted,
    trialFailed,
    subscription,
  });
}

// We enable the persistInFlight on the withApi wrapper to ensure that we don't
// cancel the in-flight requests to reload the organization details after the
// trial has been started. Otherwise if this component is unmounted as a result
// of starting the trial.
export default withSubscription(TrialStarter);
