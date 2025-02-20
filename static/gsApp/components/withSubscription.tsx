import {Component} from 'react';
import * as Sentry from '@sentry/react';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {Organization} from 'sentry/types/organization';
import getDisplayName from 'sentry/utils/getDisplayName';
import useOrganization from 'sentry/utils/useOrganization';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {Subscription} from 'getsentry/types';

type InjectedSubscriptionProps = {
  subscription: Subscription;
};

type DependentProps = {
  organization?: Organization;
  // Generalized type for routing parameters.
  params?: Record<string, any | undefined>;
  subscription?: Subscription;
};

type Options = {
  /**
   * Disable displaying the loading indicator while waiting for the
   * subscription to load.
   */
  noLoader?: boolean;
};

type State = {
  subscription?: Subscription;
};

/**
 * HoC to inject the subscription object into the wrapped component. The
 * subscription will be loaded using the current org context, either through
 * params, a passed organization prop, or finally through organization context.
 *
 * If no organization ID can be determined, the subscription will be passed as
 * a `null` value.
 */
function withSubscription<P extends InjectedSubscriptionProps>(
  WrappedComponent: React.ComponentType<P>,
  {noLoader}: Options = {}
) {
  class WithSubscription extends Component<
    Omit<P, keyof InjectedSubscriptionProps> & DependentProps,
    State
  > {
    static displayName = `withSubscription(${getDisplayName(WrappedComponent)})`;

    state: State = {
      subscription: this.props.subscription,
    };

    componentDidMount() {
      this.mounted = true;
      const orgSlug = this.getOrgSlug();

      if (orgSlug === null) {
        this.setState({subscription: this.props.subscription});
      } else {
        SubscriptionStore.get(orgSlug, (subscription: Subscription) => {
          if (!this.mounted) {
            return;
          }
          this.setState({subscription});
          this.configureScopeWithSubscriptionData(subscription);
        });
      }
    }

    componentWillUnmount() {
      this.mounted = false;
      this.unsubscribe();
    }

    unsubscribe = SubscriptionStore.listen(
      (subscription: Subscription) => this.onSubscriptionChange(subscription),
      undefined
    );
    private mounted = false;

    configureScopeWithSubscriptionData(subscription: Subscription) {
      const {plan, planTier, totalMembers, planDetails} = subscription;
      Sentry.setTag('plan', plan);
      Sentry.setTag('plan.name', planDetails?.name);
      Sentry.setTag('plan.max_members', `${planDetails?.maxMembers}`);
      Sentry.setTag('plan.total_members', `${totalMembers}`);
      Sentry.setTag('plan.tier', planTier);
    }

    onSubscriptionChange(subscription: Subscription) {
      if (subscription && this.mounted) {
        this.setState({subscription});
        this.configureScopeWithSubscriptionData(subscription);
      }
    }

    getOrgSlug() {
      if (this.props.params?.orgId) {
        return this.props.params.orgId;
      }
      if (this.props.organization) {
        return this.props.organization.slug;
      }

      return null;
    }

    render() {
      const {subscription} = this.state as State;
      const {organization, ...otherProps} = this.props;

      if (subscription === undefined) {
        return !noLoader && <LoadingIndicator />;
      }
      // Needed to solve type errors with DisabledDateRange hook.
      if (organization === undefined) {
        // TODO(any): HoC prop types not working w/ emotion https://github.com/emotion-js/emotion/issues/3261
        return (
          <WrappedComponent {...(otherProps as P as any)} subscription={subscription} />
        );
      }

      return (
        <WrappedComponent
          // TODO(any): HoC prop types not working w/ emotion https://github.com/emotion-js/emotion/issues/3261
          {...(this.props as P as any)}
          organization={organization}
          subscription={subscription}
        />
      );
    }
  }

  // XXX(epurkhiser): Until we convert this over to a FC we need the
  // intermediate functional component to access the organization context
  function WithSubscriptionWrapper(
    props: Omit<P, keyof InjectedSubscriptionProps> & DependentProps
  ) {
    const organization = useOrganization({allowNull: true});

    // TODO(any): HoC prop types not working w/ emotion https://github.com/emotion-js/emotion/issues/3261
    return (
      <WithSubscription organization={organization ?? undefined} {...(props as any)} />
    );
  }

  return WithSubscriptionWrapper;
}

export default withSubscription;
