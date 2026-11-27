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

type Props = AdminActionModalProps & {subscription: Subscription};

const REMOVE_SPONSORSHIP = 'remove';

const SPONSORED_TYPE_OPTIONS = [
  {value: 'education', label: 'Education'},
  {value: 'open_source', label: 'Open source'},
  {value: 'non_profit', label: 'Non-profit'},
  {value: 'employee', label: 'Employee'},
  {value: 'friends_and_family', label: 'Friends and family'},
];

const schema = z.object({
  sponsoredType: z.string({error: 'Select a sponsored type'}),
  audit: adminAuditSchema,
});

const defaultValues: {audit: typeof adminAuditDefaults; sponsoredType: string | null} = {
  sponsoredType: null,
  audit: adminAuditDefaults,
};

/**
 * Modal for changing or removing an account's sponsorship
 */
export function SponsorshipAction({
  Header,
  Body,
  Footer,
  closeModal,
  header,
  onConfirm,
  subscription,
}: Props) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      onConfirm({
        sponsoredType:
          value.sponsoredType === REMOVE_SPONSORSHIP ? null : value.sponsoredType,
        ...adminAuditParams(value.audit),
      });
      closeModal();
    },
  });

  const options = subscription.isSponsored
    ? [
        {value: REMOVE_SPONSORSHIP, label: 'None (remove sponsorship)'},
        ...SPONSORED_TYPE_OPTIONS,
      ]
    : SPONSORED_TYPE_OPTIONS;

  return (
    <form.AppForm form={form}>
      {header && <Header>{header}</Header>}
      <Body>
        <Stack gap="xl">
          {subscription.isSponsored && (
            <Alert.Container>
              <Alert variant="info">This account is already sponsored.</Alert>
            </Alert.Container>
          )}
          <form.Subscribe
            selector={state => state.values.sponsoredType === REMOVE_SPONSORSHIP}
          >
            {isRemoving =>
              isRemoving && (
                <Alert.Container>
                  <Alert variant="warning">
                    Removing the sponsorship takes effect immediately. The account keeps
                    its current plan and billing period, but the sponsorship's extra
                    quotas, along with any other custom reserved volumes or pay-as-you-go
                    budget, go back to the plan's defaults.
                  </Alert>
                </Alert.Container>
              )
            }
          </form.Subscribe>
          <form.AppField name="sponsoredType">
            {field => (
              <field.Layout.Stack label="Sponsored Type" required>
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={options}
                />
              </field.Layout.Stack>
            )}
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
