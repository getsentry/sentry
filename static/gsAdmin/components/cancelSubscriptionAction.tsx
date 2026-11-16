import {Fragment, useCallback, useEffect, useState} from 'react';
import moment from 'moment-timezone';

import type {
  AdminConfirmParams,
  AdminConfirmRenderProps,
} from 'admin/components/adminConfirmationModal';
import type {Subscription} from 'getsentry/types';

type Props = AdminConfirmRenderProps & {
  subscription: Subscription;
};

/**
 * Rendered as part of a openAdminConfirmModal call
 */
export function CancelSubscriptionAction({
  subscription,
  onConfirm,
  setConfirmCallback,
}: Props) {
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(true);
  const [applyBalance, setApplyBalance] = useState(true);

  const handleConfirm = useCallback(
    (params: AdminConfirmParams) => {
      onConfirm?.({cancelAtPeriodEnd, applyBalance, ...params});
    },
    [onConfirm, cancelAtPeriodEnd, applyBalance]
  );

  useEffect(() => {
    setConfirmCallback(handleConfirm);
  }, [setConfirmCallback, handleConfirm]);

  const options: Array<[boolean, string, string]> = [
    [false, 'Immediately', 'End the subscription immediately.'],
    [
      true,
      `At period end (${moment(subscription.billingPeriodEnd).format('ll')})`,
      'End the subscription at the end of the current contract period.',
    ],
  ];

  return (
    <Fragment>
      {options.map(([enabled, label, help]) => (
        <div key={enabled.toString()}>
          <label
            style={{marginBottom: 10, position: 'relative'}}
            key="cancelAtPeriodEnd"
            aria-label={label}
          >
            <div style={{position: 'absolute', left: 0, width: 20}}>
              <input
                type="radio"
                name="cancelAtPeriodEnd"
                checked={cancelAtPeriodEnd === enabled}
                onChange={() => setCancelAtPeriodEnd(enabled)}
              />
            </div>
            <div style={{marginLeft: 25}}>
              <strong>{label}</strong>
              <br />
              <small style={{fontWeight: 'normal'}}>{help}</small>
            </div>
          </label>
          {enabled ? null : (
            <label
              style={{
                marginBottom: 10,
                marginLeft: 25,
                position: 'relative',
              }}
              key="credit"
            >
              <input
                type="checkbox"
                name="applyBalance"
                checked={applyBalance}
                style={{marginRight: 5}}
                onChange={e => setApplyBalance(e.target.checked)}
                disabled={cancelAtPeriodEnd !== enabled}
              />
              Apply credit for the remaining time on their subscription.
            </label>
          )}
        </div>
      ))}
    </Fragment>
  );
}
