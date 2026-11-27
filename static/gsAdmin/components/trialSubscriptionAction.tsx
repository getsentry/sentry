import moment from 'moment-timezone';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';

import type {AdminActionModalProps} from 'admin/components/adminConfirmationModal';
import {
  AdminAuditFields,
  adminAuditDefaults,
  adminAuditParams,
  adminAuditSchema,
} from 'admin/components/adminConfirmationModal';
import type {Subscription} from 'getsentry/types';

type Props = AdminActionModalProps & {
  subscription: Subscription;
  startEnterpriseTrial?: boolean;
};

const schema = z.object({
  trialDays: z
    .number({error: 'Enter a number of days greater than zero'})
    .int()
    .positive('Enter a number of days greater than zero'),
  audit: adminAuditSchema,
});

/**
 * Modal for starting or extending a subscription trial
 */
export function TrialSubscriptionAction({
  Header,
  Body,
  Footer,
  closeModal,
  header,
  onConfirm,
  subscription,
  startEnterpriseTrial,
}: Props) {
  const defaultValues: {audit: typeof adminAuditDefaults; trialDays: number | null} = {
    trialDays: subscription.isEnterpriseTrial || startEnterpriseTrial ? 28 : 14,
    audit: adminAuditDefaults,
  };

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    // The trial plan is resolved server-side: new enterprise trials always
    // start on the latest tier.
    onSubmit: ({value}) => {
      onConfirm({
        trialDays: value.trialDays,
        ...(startEnterpriseTrial && {startEnterpriseTrial}),
        ...adminAuditParams(value.audit),
      });
      closeModal();
    },
  });

  return (
    <form.AppForm form={form}>
      {header && <Header>{header}</Header>}
      <Body>
        <Stack gap="xl">
          {startEnterpriseTrial && (
            <Alert.Container>
              <Alert variant="info">
                Spike protection will need to be manually disabled.
              </Alert>
            </Alert.Container>
          )}
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
                  hintText={`Their trial will end on ${trialEndDate}`}
                >
                  <field.Number value={field.state.value} onChange={field.handleChange} />
                </field.Layout.Stack>
              );
            }}
          </form.AppField>
          <AdminAuditFields form={form} fields="audit" />
        </Stack>
      </Body>
      <Footer>
        <Flex align="center" gap="xl">
          <Button onClick={closeModal}>Cancel</Button>
          <form.SubmitButton>Confirm</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}
