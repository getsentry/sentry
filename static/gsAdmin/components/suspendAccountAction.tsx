import {z} from 'zod';

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

const schema = z.object({
  suspensionReason: z.string().min(1, 'Select a suspension reason'),
  audit: adminAuditSchema,
});

const defaultValues: z.input<typeof schema> = {
  suspensionReason: '',
  audit: adminAuditDefaults,
};

export function SuspendAccountAction({
  Header,
  Body,
  Footer,
  closeModal,
  header,
  onConfirm,
}: AdminActionModalProps) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      onConfirm({
        suspensionReason: value.suspensionReason,
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
          <form.AppField name="suspensionReason">
            {field => (
              <field.RadioGroup value={field.state.value} onChange={field.handleChange}>
                {({Item}) => (
                  <field.Layout.Stack label="Suspension Reason">
                    {suspendReasons.map(([key, label, help]) => (
                      <Item key={key} value={key} description={help}>
                        {label}
                      </Item>
                    ))}
                  </field.Layout.Stack>
                )}
              </field.RadioGroup>
            )}
          </form.AppField>
          <AdminAuditFields form={form} fields="audit" />
        </Stack>
      </Body>
      <Footer>
        <Flex align="center" gap="xl">
          <Button onClick={closeModal}>Cancel</Button>
          <form.SubmitButton variant="danger">Suspend Account</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}
