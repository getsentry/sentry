import {Component} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import withOrganization from 'sentry/utils/withOrganization';

import {PlanTier} from 'getsentry/types';
import AMCheckout from 'getsentry/views/amCheckout';

type Props = {
  organization: Organization;
} & RouteComponentProps<Record<PropertyKey, unknown>, unknown>;

type State = {
  tier: string | null;
};

class DecideCheckout extends Component<Props, State> {
  state: State = {
    tier: null,
  };

  onToggleLegacy = (tier: string) => {
    this.setState({tier});
  };

  render() {
    const {tier} = this.state;
    const props = {...this.props, onToggleLegacy: this.onToggleLegacy};

    const hasAm3Feature = props.organization?.features?.includes('am3-billing');
    const hasPartnerMigrationFeature = props.organization?.features.includes(
      'partner-billing-migration'
    );
    if (hasAm3Feature || hasPartnerMigrationFeature) {
      return (
        <ErrorBoundary errorTag={{checkout: PlanTier.AM3}}>
          <AMCheckout checkoutTier={PlanTier.AM3} {...props} />
        </ErrorBoundary>
      );
    }

    if (tier !== PlanTier.AM1) {
      return (
        <ErrorBoundary errorTag={{checkout: PlanTier.AM2}}>
          <AMCheckout checkoutTier={PlanTier.AM2} {...props} />
        </ErrorBoundary>
      );
    }

    return (
      <ErrorBoundary errorTag={{checkout: PlanTier.AM1}}>
        <AMCheckout checkoutTier={PlanTier.AM1} {...props} />
      </ErrorBoundary>
    );
  }
}

export default withOrganization(DecideCheckout);
