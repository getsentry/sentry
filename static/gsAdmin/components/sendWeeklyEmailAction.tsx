import {useEffect} from 'react';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {toast} from '@sentry/scraps/toast';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

import type {AdminConfirmRenderProps} from 'admin/components/adminConfirmationModal';

type Props = {orgId: string} & AdminConfirmRenderProps;

type WeeklyEmailData = {deliveryEmail: string; dryRun: boolean; targetEmail: string};

const schema = z
  .object({targetEmail: z.string(), deliveryEmail: z.string(), dryRun: z.boolean()})
  .refine(value => value.dryRun || value.deliveryEmail !== '', {
    message: 'Delivery email address is required when dry run is disabled',
    path: ['deliveryEmail'],
  });

const defaultValues: z.input<typeof schema> = {
  targetEmail: '',
  deliveryEmail: '',
  dryRun: false,
};

/**
 * Rendered as part of a openAdminConfirmModal call
 */
export function SendWeeklyEmailAction({orgId, setConfirmCallback}: Props) {
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

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    // The modal has already closed, so report the problem in a toast.
    onSubmitInvalid: () => {
      toast.error('Delivery email address is required when dry run is disabled');
    },
    onSubmit: ({value}) => {
      toast.loading('Sending Email');
      mutate(value);
    },
  });

  useEffect(() => {
    setConfirmCallback(() => form.handleSubmit());
  }, [setConfirmCallback, form]);

  return (
    <form.AppForm form={form}>
      <Stack gap="lg">
        <form.AppField name="targetEmail">
          {field => (
            <field.Layout.Stack
              label="Target User Email"
              hintText="The weekly email will be generated based on this user. If left empty the email will be generated for a user with access to all projects"
            >
              <field.Input
                autoFocus
                value={field.state.value}
                onChange={field.handleChange}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.Subscribe selector={state => state.values.dryRun}>
          {dryRun => (
            <form.AppField name="deliveryEmail">
              {field => (
                <field.Layout.Stack
                  label="Delivery email address"
                  hintText="The weekly email will be sent to this address."
                  required={!dryRun}
                >
                  <field.Input value={field.state.value} onChange={field.handleChange} />
                </field.Layout.Stack>
              )}
            </form.AppField>
          )}
        </form.Subscribe>
        <form.AppField name="dryRun">
          {field => (
            <field.Layout.Stack
              label="Dry Run"
              hintText="When enabled, generates the report without sending an email for performance testing. Delivery email address is not required in dry run mode. When disabled, a delivery email address must be provided."
            >
              <field.Switch checked={field.state.value} onChange={field.handleChange} />
            </field.Layout.Stack>
          )}
        </form.AppField>
      </Stack>
    </form.AppForm>
  );
}
