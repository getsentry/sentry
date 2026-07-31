import {Component, Fragment} from 'react';
import moment from 'moment-timezone';

import {Alert} from '@sentry/scraps/alert';

import {BooleanField} from 'sentry/components/forms/fields/booleanField';
import {NumberField} from 'sentry/components/forms/fields/numberField';

import type {
  AdminConfirmParams,
  AdminConfirmRenderProps,
} from 'admin/components/adminConfirmationModal';
import type {Subscription} from 'getsentry/types';
import {isTrial} from 'getsentry/utils/billing';

type Props = AdminConfirmRenderProps & {
  subscription: Subscription;
  startEnterpriseTrial?: boolean;
};

type State = {
  startTrialOnLatestTier: boolean;
  trialDays: number;
};

/**
 * Rendered as part of a openAdminConfirmModal call
 */
export class TrialSubscriptionAction extends Component<Props, State> {
  state: State = {
    trialDays:
      this.props.subscription.isEnterpriseTrial || this.props.startEnterpriseTrial
        ? 28
        : 14,
    startTrialOnLatestTier: false,
  };

  componentDidMount() {
    this.props.setConfirmCallback(this.handleConfirm);
  }

  handleConfirm = (_params: AdminConfirmParams) => {
    const {trialDays, startTrialOnLatestTier} = this.state;
    const {startEnterpriseTrial, onConfirm} = this.props;

    // XXX(epurkhiser): In the original implementation none of the audit params
    // were passed, is that an oversight?
    //
    // The trial tier is resolved server-side (omitting `trialTier` falls back
    // to the subscription's default enterprise-trial plan). Passing
    // `startTrialOnLatestTier` instead opts into the latest available tier.
    const data = {
      trialDays,
      ...(startEnterpriseTrial && {startEnterpriseTrial}),
      ...(startEnterpriseTrial && startTrialOnLatestTier && {startTrialOnLatestTier}),
    };

    onConfirm?.(data);
  };

  onDaysChange = (value: string) => {
    const trialDays = parseInt(value, 10) || 0;
    this.setState({trialDays});
    this.props.disableConfirmButton(trialDays <= 0);
  };

  get actionLabel(): string {
    const {subscription, startEnterpriseTrial} = this.props;

    if (startEnterpriseTrial) {
      return 'Start Enterprise Trial';
    }
    return isTrial(subscription) ? 'Extend Trial' : 'Start Trial';
  }

  render() {
    const {subscription, startEnterpriseTrial} = this.props;
    const {trialDays, startTrialOnLatestTier} = this.state;

    if (!subscription) {
      return null;
    }

    const currentTrialEnd = moment(
      (!startEnterpriseTrial && subscription.trialEnd) || undefined
    );
    const trialEndDate = currentTrialEnd.add(trialDays, 'days').format('MMMM Do YYYY');

    return (
      <Fragment>
        {startEnterpriseTrial && (
          <Alert.Container>
            <Alert variant="info">
              Spike protection will need to be manually disabled.
            </Alert>
          </Alert.Container>
        )}
        <NumberField
          inline={false}
          stacked
          flexibleControlStateSize
          label="Number of Days"
          help={
            <Fragment>
              Their trial will end on <strong>{trialEndDate}</strong>
            </Fragment>
          }
          name="days"
          value={trialDays}
          onChange={this.onDaysChange}
        />
        {startEnterpriseTrial && (
          <BooleanField
            inline={false}
            stacked
            flexibleControlStateSize
            label="Trial the latest tier"
            help="Start the trial on the latest available tier instead of the tier that matches their current plan."
            name="startTrialOnLatestTier"
            value={startTrialOnLatestTier}
            onChange={(value: boolean) => this.setState({startTrialOnLatestTier: value})}
          />
        )}
      </Fragment>
    );
  }
}
