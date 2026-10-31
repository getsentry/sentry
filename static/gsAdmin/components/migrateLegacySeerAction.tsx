import {Fragment, useCallback, useEffect, useState} from 'react';
import moment from 'moment-timezone';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';

import type {
  AdminConfirmParams,
  AdminConfirmRenderProps,
} from 'admin/components/adminConfirmationModal';
import type {Subscription} from 'getsentry/types';

type Props = {
  orgId: string;
  subscription: Subscription;
} & AdminConfirmRenderProps;

/**
 * Rendered as part of an openAdminConfirmModal call.
 * Posts to the CustomerMigrateLegacySeerAdminEndpoint to migrate a single
 * organization off legacy Seer reserved budgets.
 */
export function MigrateLegacySeerAction({
  orgId,
  subscription,
  setConfirmCallback,
}: Props) {
  const api = useApi({persistInFlight: true});
  const [applyImmediately, setApplyImmediately] = useState(true);
  const [addSeerTrial, setAddSeerTrial] = useState(true);

  const handleConfirm = useCallback(
    (_params: AdminConfirmParams) => {
      addLoadingMessage('Running legacy Seer migration…');
      api
        .requestPromise(`/customers/${orgId}/migrate-legacy-seer/`, {
          method: 'POST',
          data: {applyImmediately, addSeerTrial},
        })
        .then(() => {
          addSuccessMessage('Legacy Seer migration complete.');
        })
        .catch(res => {
          if (
            res instanceof RequestError &&
            typeof res.responseJSON?.detail === 'string'
          ) {
            addErrorMessage(res.responseJSON.detail);
          } else if (res instanceof RequestError && res.responseText) {
            addErrorMessage(res.responseText);
          } else {
            addErrorMessage('Migration failed.');
          }
        });
    },
    [api, orgId, applyImmediately, addSeerTrial]
  );

  useEffect(() => {
    setConfirmCallback(handleConfirm);
  }, [setConfirmCallback, handleConfirm]);

  const periodEnd = moment(subscription.onDemandPeriodEnd).format('ll');

  const timingOptions: Array<[boolean, string, string]> = [
    [
      true,
      'Immediately',
      `Remove legacy Seer from the subscription right now. The current billing period end (${periodEnd}) is unchanged — the org will simply be invoiced at that date without the legacy Seer line item.`,
    ],
    [
      false,
      `At period end (${periodEnd})`,
      'Stage the removal to apply at the start of the next billing period.',
    ],
  ];

  return (
    <Fragment>
      <p>Migrate a user off Legacy Seer to allow them to use the seat-based Seer plan.</p>

      {timingOptions.map(([value, label, help]) => (
        <div key={String(value)}>
          <label style={{marginBottom: 10, position: 'relative'}}>
            <div style={{position: 'absolute', left: 0, width: 20}}>
              <input
                type="radio"
                name="applyImmediately"
                checked={applyImmediately === value}
                onChange={() => setApplyImmediately(value)}
              />
            </div>
            <div style={{marginLeft: 25}}>
              <strong>{label}</strong>
              <br />
              <small style={{fontWeight: 'normal'}}>{help}</small>
            </div>
          </label>
        </div>
      ))}

      <label style={{marginBottom: 4, marginTop: 10, display: 'block'}}>
        <input
          type="checkbox"
          name="addSeerTrial"
          checked={addSeerTrial}
          style={{marginRight: 5}}
          onChange={e => setAddSeerTrial(e.target.checked)}
        />
        <strong>Add 14-day Seer seat trial</strong>{' '}
        {applyImmediately
          ? 'starting immediately'
          : `starting at the next billing period (${periodEnd})`}
        .
      </label>
      <p style={{marginTop: 20}}>
        After migration, users opt in to Seer from their organization settings. Share this
        link with the customer:{' '}
        <a
          href="https://docs.sentry.io/product/ai-in-sentry/seer/#getting-started-with-seer"
          target="_blank"
          rel="noreferrer"
        >
          Getting Started with Seer
        </a>
        .
      </p>
    </Fragment>
  );
}
