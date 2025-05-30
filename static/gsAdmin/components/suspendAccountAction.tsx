import {Fragment, useCallback, useEffect, useState} from 'react';

import type {
  AdminConfirmParams,
  AdminConfirmRenderProps,
} from 'admin/components/adminConfirmationModal';

// Make sure these match the values in the backend
// See https://github.com/getsentry/getsentry/blob/cf837619ae7c76e852666afc5578abc0f3f0a97b/getsentry/models/subscription.py#L147
const suspendReasons = [
  ['event_volume', 'Event Volume', 'This account has greatly exceeded its paid volume'],
  ['fraud', 'Fraudulent', 'This account was reported as fraudulent'],
  ['dispute', 'Dispute', 'This account has recently had a charge disputed'],
  ['past_due', 'Past Due', 'This account has a past balance which needs to be paid.'],
] as const;

/**
 * Rendered as part of a openAdminConfirmModal call
 */
function SuspendAccountAction(props: AdminConfirmRenderProps) {
  const [suspensionReason, setSuspensionReason] = useState<
    (typeof suspendReasons)[number][0] | null
  >(null);

  const {setConfirmCallback, onConfirm, disableConfirmButton} = props;

  const handleConfirm = useCallback(
    (_params: AdminConfirmParams) => {
      // XXX(epurkhiser): In the original implementation none of the audit params
      // were passed, is that an oversight?
      onConfirm?.({suspensionReason});
    },
    [onConfirm, suspensionReason]
  );

  useEffect(() => {
    setConfirmCallback(handleConfirm);
  }, [setConfirmCallback, handleConfirm]);

  return (
    <Fragment>
      {suspendReasons.map(([key, label, help]) => (
        <label style={{marginBottom: 10, position: 'relative'}} key={key}>
          <div style={{position: 'absolute', left: 0, width: 20}}>
            <input
              data-test-id={`suspend-radio-btn-${key}`}
              aria-label={label}
              type="radio"
              name="suspensionReason"
              value={key}
              checked={suspensionReason === key}
              onChange={() => {
                setSuspensionReason(key);
                disableConfirmButton(false);
              }}
            />
          </div>
          <div style={{marginLeft: 25}}>
            <strong>{label}</strong>
            <br />
            <small style={{fontWeight: 'normal'}}>{help}</small>
          </div>
        </label>
      ))}
    </Fragment>
  );
}

export default SuspendAccountAction;
