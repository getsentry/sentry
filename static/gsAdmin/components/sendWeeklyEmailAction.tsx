import {useEffect, useRef, useState} from 'react';
import {useMutation} from '@tanstack/react-query';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
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
  const [data, setData] = useState<WeeklyEmailData>({
    targetEmail: '',
    deliveryEmail: '',
    dryRun: false,
  });
  const dataRef = useRef(data);

  const updateData = (update: Partial<WeeklyEmailData>) => {
    dataRef.current = {...dataRef.current, ...update};
    setData(dataRef.current);
  };

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
      addSuccessMessage('Email queued');
    },
    onError: error => {
      if (error instanceof RequestError) {
        if (error.status === 404) {
          addErrorMessage('User is not a member of the organization!');
        } else {
          addErrorMessage(error.responseText || error.name);
        }
      }
    },
  });

  useEffect(() => {
    setConfirmCallback(() => {
      const latest = dataRef.current;

      if (!latest.dryRun && !latest.deliveryEmail) {
        addErrorMessage('Delivery email address is required when dry run is disabled');
        return;
      }

      addLoadingMessage('Sending Email');
      mutate(latest);
    });
    // setConfirmCallback changes every parent render and sets parent state, so depending on it loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        value={data.targetEmail}
        onChange={(targetEmail: string) => updateData({targetEmail})}
      />
      <TextField
        autoFocus
        inline={false}
        stacked
        flexibleControlStateSize
        label="Delivery email address"
        help="The weekly email will be sent to this address."
        required={!data.dryRun}
        name="username"
        inputMode="text"
        value={data.deliveryEmail}
        onChange={(deliveryEmail: string) => updateData({deliveryEmail})}
      />
      <BooleanField
        label="Dry Run"
        help="When enabled, generates the report without sending an email for performance testing. Delivery email address is not required in dry run mode. When disabled, a delivery email address must be provided."
        inline={false}
        name="dryrun"
        stacked
        value={data.dryRun}
        onChange={(dryRun: boolean) => updateData({dryRun})}
      />
    </div>
  );
}
