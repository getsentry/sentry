import {Component} from 'react';

import {t} from 'sentry/locale';
import HookStore from 'sentry/stores/hookStore';
import type {Scope} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {
  NavigationItem,
  NavigationProps,
  NavigationSection,
} from 'sentry/views/settings/types';

import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';

type Props = {
  organization: Organization;
  subscription: Subscription;
};

type NavProps = NavigationProps & {
  access?: Set<Scope>;
};

class GSBillingNavigationConfig extends Component<Props> {
  componentDidMount() {
    // Clear store before adding since this can be called multiple times
    HookStore.remove('settings:organization-navigation-config', this.getConfig);
    HookStore.add('settings:organization-navigation-config', this.getConfig);
  }

  componentWillUnmount() {
    HookStore.remove('settings:organization-navigation-config', this.getConfig);
  }

  getConfig = (organization: Organization): NavigationSection => {
    const {subscription} = this.props;
    const membersCanViewSubscriptionInfo = subscription.canSelfServe;
    const prefix = '/settings/:orgId';
    const items: NavigationItem[] = [
      {
        path: `${prefix}/billing/`,
        title: t('Subscription'),
        show: ({access}: NavProps) =>
          access?.has('org:billing') || membersCanViewSubscriptionInfo,
        id: 'subscription',
      },
      {
        path: `${prefix}/subscription/spend-allocations/`,
        title: t('Spend Allocations'),
        show: () => organization.features.includes('spend-allocations'),
        id: 'spend-allocations',
        description: t('Guarantee monthly event volume to your priority projects.'),
      },
      {
        path: `${prefix}/spike-protection/`,
        title: t('Spike Protection'),
        id: 'spike',
      },
      {
        path: `${prefix}/subscription/redeem-code/`,
        title: t('Redeem Promo Code'),
        id: 'promo',
      },
      {
        path: `${prefix}/legal/`,
        title: t('Legal & Compliance'),
        id: 'legal',
      },
    ];

    return {
      name: t('Usage & Billing'),
      items,
    };
  };

  render() {
    return null;
  }
}

export default withSubscription(GSBillingNavigationConfig, {noLoader: true});
