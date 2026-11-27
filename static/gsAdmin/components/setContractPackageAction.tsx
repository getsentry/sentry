import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {AdminActionModalProps} from 'admin/components/adminConfirmationModal';
import {
  AdminAuditFields,
  adminAuditDefaults,
  adminAuditParams,
  adminAuditSchema,
} from 'admin/components/adminConfirmationModal';

const schema = z.object({
  packageUid: z.string().trim().min(1, 'Enter a package UID'),
  audit: adminAuditSchema,
});

const defaultValues: z.input<typeof schema> = {packageUid: '', audit: adminAuditDefaults};

/**
 * Modal for pointing the current contract at another package
 */
export function SetContractPackageAction({
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
      const {packageUid, audit} = schema.parse(value);
      onConfirm({packageUid, ...adminAuditParams(audit)});
      closeModal();
    },
  });

  return (
    <form.AppForm form={form}>
      {header && <Header>{header}</Header>}
      <Body>
        <Stack gap="xl">
          <Text>
            Point the current contract at another package immediately. This skips
            checkout, so there is no proration, invoice, or rollover. Clear any pending
            changes first.
          </Text>
          <form.AppField name="packageUid">
            {field => (
              <field.Layout.Stack label="Package UID">
                <field.Input
                  placeholder="Package UID"
                  value={field.state.value}
                  onChange={field.handleChange}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <AdminAuditFields form={form} fields="audit" showTicketURL={false} />
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
