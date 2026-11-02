import {useCallback, useEffect, useState} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {BooleanField} from 'sentry/components/forms/fields/booleanField';
import {TextField} from 'sentry/components/forms/fields/textField';
import {RequestError} from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

import type {
  AdminConfirmParams,
  AdminConfirmRenderProps,
} from 'admin/components/adminConfirmationModal';

type Props = {orgId: string} & AdminConfirmRenderProps;

/**
 * Rendered as part of a openAdminConfirmModal call
 */
export function SendWeeklyEmailAction({orgId, setConfirmCallback}: Props) {
  const api = useApi();
  const [dryRun, setDryRun] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');
  const [deliveryEmail, setDeliveryEmail] = useState('');

  const handleConfirm = useCallback(
    (_params: AdminConfirmParams) => {
      if (!dryRun && !deliveryEmail) {
        addErrorMessage('Delivery email address is required when dry run is disabled');
        return;
      }

      addLoadingMessage('Sending Email');
      api
        .requestPromise(`/customers/${orgId}/send-weekly-email/`, {
          method: 'POST',
          data: {targetEmail, deliveryEmail, dryRun},
        })
        .then(() => {
          addSuccessMessage('Email queued');
        })
        .catch(res => {
          if (res instanceof RequestError) {
            if (res.status === 404) {
              addErrorMessage('User is not a member of the organization!');
            } else {
              addErrorMessage(res.responseText || res.name);
            }
          }
        });
    },
    [api, orgId, dryRun, deliveryEmail, targetEmail]
  );

  useEffect(() => {
    setConfirmCallback(handleConfirm);
  }, [setConfirmCallback, handleConfirm]);

  return (
    <div>
      <TextField
        autoFocus
        inline={false}
        stacked
        flexibleControlStateSize
        label="Target User Email"
        help="The weekly email will be generated based on this user. If left empty the email will be generated for a user with access to all projects"
        name="username"
        inputMode="text"
        value={targetEmail}
        onChange={(value: any) => setTargetEmail(value)}
      />
      <TextField
        autoFocus
        inline={false}
        stacked
        flexibleControlStateSize
        label="Delivery email address"
        help="The weekly email will be sent to this address."
        required={!dryRun}
        name="username"
        inputMode="text"
        value={deliveryEmail}
        onChange={(value: any) => setDeliveryEmail(value)}
      />
      <BooleanField
        label="Dry Run"
        help="When enabled, generates the report without sending an email for performance testing. Delivery email address is not required in dry run mode. When disabled, a delivery email address must be provided."
        inline={false}
        name="dryrun"
        stacked
        value={dryRun}
        onChange={(value: any) => setDryRun(value)}
      />
    </div>
  );
}
