import {Fragment, useEffect, useState} from 'react';
import moment from 'moment-timezone';

import {Alert} from '@sentry/scraps/alert';

import {NumberField} from 'sentry/components/forms/fields/numberField';

import type {
  AdminConfirmParams,
  AdminConfirmRenderProps,
} from 'admin/components/adminConfirmationModal';
import type {Subscription} from 'getsentry/types';

type Props = AdminConfirmRenderProps & {
  subscription: Subscription;
  startEnterpriseTrial?: boolean;
};

/**
 * Rendered as part of a openAdminConfirmModal call
 */
export function TrialSubscriptionAction({
  subscription,
  startEnterpriseTrial,
  onConfirm,
  setConfirmCallback,
  disableConfirmButton,
}: Props) {
  const [trialDays, setTrialDays] = useState(
    subscription?.isEnterpriseTrial || startEnterpriseTrial ? 28 : 14
  );

  // Re-register the confirm callback whenever its inputs change so the modal
  // always submits the latest trialDays value.
  useEffect(() => {
    setConfirmCallback((_params: AdminConfirmParams) => {
      // XXX(epurkhiser): In the original implementation none of the audit params
      // were passed, is that an oversight?
      //
      // The trial plan is resolved server-side: new enterprise trials always
      // start on the latest tier.
      const data = {
        trialDays,
        ...(startEnterpriseTrial && {startEnterpriseTrial}),
      };

      onConfirm?.(data);
    });
  }, [setConfirmCallback, onConfirm, trialDays, startEnterpriseTrial]);

  const onDaysChange = (value: string) => {
    const days = parseInt(value, 10) || 0;
    setTrialDays(days);
    disableConfirmButton(days <= 0);
  };

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
        onChange={onDaysChange}
      />
    </Fragment>
  );
}
