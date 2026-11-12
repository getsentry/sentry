import {useEffect, useRef, useState} from 'react';

import type {AdminConfirmRenderProps} from 'admin/components/adminConfirmationModal';

// Make sure these match the values in the backend
// See https://github.com/getsentry/getsentry/blob/cf837619ae7c76e852666afc5578abc0f3f0a97b/getsentry/models/subscription.py#L147
const suspendReasons = [
  ['event_volume', 'Event Volume', 'This account has greatly exceeded its paid volume'],
  ['fraud', 'Fraudulent', 'This account was reported as fraudulent'],
  ['dispute', 'Dispute', 'This account has recently had a charge disputed'],
  ['past_due', 'Past Due', 'This account has a past balance which needs to be paid.'],
  [
    'security_abuse',
    'Security/Abuse',
    'This account has been suspended for security or abuse reasons',
  ],
] as const;

type SuspensionReason = (typeof suspendReasons)[number][0] | null;

/**
 * Rendered as part of a openAdminConfirmModal call
 */
export function SuspendAccountAction({
  onConfirm,
  setConfirmCallback,
  disableConfirmButton,
}: AdminConfirmRenderProps) {
  const [suspensionReason, setSuspensionReason] = useState<SuspensionReason>(null);

  // Holds the latest selection so the confirm callback (registered once on
  // mount) always reads the current value.
  const suspensionReasonRef = useRef<SuspensionReason>(null);

  useEffect(() => {
    // XXX(epurkhiser): In the original implementation none of the audit params
    // were passed, is that an oversight?
    setConfirmCallback(() => {
      onConfirm?.({suspensionReason: suspensionReasonRef.current});
    });
    // Only register the callback once on mount. setConfirmCallback is recreated
    // on every parent render and updates parent state, so depending on it would
    // cause an infinite render loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return suspendReasons.map(([key, label, help]) => (
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
            suspensionReasonRef.current = key;
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
  ));
}
