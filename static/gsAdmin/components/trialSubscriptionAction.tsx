import {Component, Fragment} from 'react';
import moment from 'moment-timezone';

import {Alert} from '@sentry/scraps/alert';

import {NumberField} from 'sentry/components/forms/fields/numberField';
import {SelectField} from 'sentry/components/forms/fields/selectField';

import type {
  AdminConfirmParams,
  AdminConfirmRenderProps,
} from 'admin/components/adminConfirmationModal';
import type {Subscription} from 'getsentry/types';
import {PlanTier} from 'getsentry/types';

type Props = AdminConfirmRenderProps & {
  subscription: Subscription;
  startEnterpriseTrial?: boolean;
};

type State = {
  trialDays: number;
  trialTier?: PlanTier;
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
    trialTier: PlanTier.AM3,
  };

  componentDidMount() {
    this.props.setConfirmCallback(this.handleConfirm);
  }

  handleConfirm = (_params: AdminConfirmParams) => {
    const {trialDays, trialTier} = this.state;
    const {startEnterpriseTrial, onConfirm} = this.props;

    // XXX(epurkhiser): In the original implementation none of the audit params
    // were passed, is that an oversight?

    const data = {
      trialDays,
      ...(startEnterpriseTrial && {
        startEnterpriseTrial,
        trialTier,
      }),
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
    return subscription.isTrial ? 'Extend Trial' : 'Start Trial';
  }

  render() {
    const {subscription, startEnterpriseTrial} = this.props;
    const {trialDays, trialTier} = this.state;

    if (!subscription) {
      return null;
    }

    const currentTrialEnd = moment(
      (!startEnterpriseTrial && subscription.trialEnd) || undefined
    );
    const trialEndDate = currentTrialEnd.add(trialDays, 'days').format('MMMM Do YYYY');

    const tierChoices: Array<[string | PlanTier, string | PlanTier]> = [
      [PlanTier.AM3, PlanTier.AM3],
      [PlanTier.AM2, PlanTier.AM2],
      [PlanTier.AM1, PlanTier.AM1],
    ];

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
        <div data-test-id="trial-plan-tier-choices">
          {startEnterpriseTrial && (
            <SelectField
              inline={false}
              stacked
              flexibleControlStateSize
              label="Trial Plan Tier"
              name="tier"
              value={trialTier}
              onChange={(val: any) => {
                this.setState({trialTier: val});
              }}
              choices={tierChoices}
            />
          )}
        </div>
      </Fragment>
    );
  }
}
