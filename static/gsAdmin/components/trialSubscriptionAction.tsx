import {Fragment, useEffect} from 'react';
import moment from 'moment-timezone';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';

import type {AdminConfirmRenderProps} from 'admin/components/adminConfirmationModal';
import {adminConfirmFormOptions} from 'admin/components/adminConfirmationModal';
import type {Subscription} from 'getsentry/types';

type Props = AdminConfirmRenderProps & {
  subscription: Subscription;
  startEnterpriseTrial?: boolean;
};

const schema = z.object({
  trialDays: z
    .number()
    .int()
    .positive('Enter a number of days greater than zero')
    .nullable()
    .refine(value => value !== null, 'Enter a number of days greater than zero'),
});

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
  const defaultValues: z.input<typeof schema> = {
    trialDays: subscription.isEnterpriseTrial || startEnterpriseTrial ? 28 : 14,
  };

  const form = useScrapsForm({
    ...defaultFormOptions,
    ...adminConfirmFormOptions(schema, disableConfirmButton),
    defaultValues,
    validators: {onDynamic: schema},
    // XXX(epurkhiser): In the original implementation none of the audit params
    // were passed, is that an oversight?
    //
    // The trial plan is resolved server-side: new enterprise trials always
    // start on the latest tier.
    onSubmit: ({value}) => {
      onConfirm?.({
        trialDays: value.trialDays,
        ...(startEnterpriseTrial && {startEnterpriseTrial}),
      });
    },
  });

  useEffect(() => {
    setConfirmCallback(params => form.handleSubmit(params));
  }, [setConfirmCallback, form]);

  return (
    <Fragment>
      {startEnterpriseTrial && (
        <Alert.Container>
          <Alert variant="info">
            Spike protection will need to be manually disabled.
          </Alert>
        </Alert.Container>
      )}
      <form.AppForm form={form}>
        <form.AppField name="trialDays">
          {field => {
            const trialEndDate = moment(
              (!startEnterpriseTrial && subscription.trialEnd) || undefined
            )
              .add(field.state.value ?? 0, 'days')
              .format('MMMM Do YYYY');

            return (
              <field.Layout.Stack
                label="Number of Days"
                hintText={
                  <Fragment>
                    Their trial will end on <strong>{trialEndDate}</strong>
                  </Fragment>
                }
              >
                <field.Number value={field.state.value} onChange={field.handleChange} />
              </field.Layout.Stack>
            );
          }}
        </form.AppField>
      </form.AppForm>
    </Fragment>
  );
}
