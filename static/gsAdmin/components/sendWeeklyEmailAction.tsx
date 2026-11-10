import {useEffect, useState} from 'react';
import {useMutation} from '@tanstack/react-query';

import {toast} from '@sentry/scraps/toast';

import {BooleanField} from 'sentry/components/forms/fields/booleanField';
import {TextField} from 'sentry/components/forms/fields/textField';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

import type {AdminConfirmRenderProps} from 'admin/components/adminConfirmationModal';

type Props = {orgId: string} & AdminConfirmRenderProps;

type WeeklyEmailData = {
  deliveryEmail: string;
  dryRun: boolean;
  targetEmail: string;
};

/**
 * Rendered as part of a openAdminConfirmModal call
 */
export function SendWeeklyEmailAction({orgId, setConfirmCallback}: Props) {
  const [targetEmail, setTargetEmail] = useState('');
  const [deliveryEmail, setDeliveryEmail] = useState('');
  const [dryRun, setDryRun] = useState(false);

  // The modal unmounts before the request settles; only hook-level callbacks still run.
  const {mutate} = useMutation({
    mutationFn: (payload: WeeklyEmailData) =>
      fetchMutation({
        method: 'POST',
        url: getApiUrl('/customers/$organizationIdOrSlug/send-weekly-email/', {
          path: {organizationIdOrSlug: orgId},
        }),
        data: payload,
      }),
    onSuccess: () => {
      toast.success('Email queued');
    },
    onError: error => {
      if (error instanceof RequestError) {
        if (error.status === 404) {
          toast.error('User is not a member of the organization!');
        } else {
          toast.error(error.responseText || error.name);
        }
      }
    },
  });

  useEffect(() => {
    setConfirmCallback(() => {
      if (!dryRun && !deliveryEmail) {
        toast.error('Delivery email address is required when dry run is disabled');
        return;
      }

      toast.loading('Sending Email');
      mutate({targetEmail, deliveryEmail, dryRun});
    });
  }, [setConfirmCallback, mutate, targetEmail, deliveryEmail, dryRun]);

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
        onChange={setTargetEmail}
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
        onChange={setDeliveryEmail}
      />
      <BooleanField
        label="Dry Run"
        help="When enabled, generates the report without sending an email for performance testing. Delivery email address is not required in dry run mode. When disabled, a delivery email address must be provided."
        inline={false}
        name="dryrun"
        stacked
        value={dryRun}
        onChange={setDryRun}
      />
    </div>
  );
}
