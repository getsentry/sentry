import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormValidators, ScrapsForm, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';

import type {Subscription} from 'getsentry/types';
import {formatBalance} from 'getsentry/utils/billing';

const STARTUP_PROGRAM_OPTIONS = [
  {value: 'ycombinator', label: 'ycombinator'},
  {value: 'sentryforstartups', label: 'sentryforstartups'},
  {value: 'a16z', label: 'a16z'},
  {value: 'accelatoms', label: 'accelatoms'},
  {value: 'accelfam', label: 'accelfam'},
  {value: 'renderstack', label: 'renderstack'},
  {value: 'finpack', label: 'finpack'},
  {value: 'betaworks', label: 'betaworks'},
  {value: 'alchemist', label: 'alchemist'},
  {value: 'antler', label: 'antler'},
  {value: 'mass ai coalition', label: 'mass ai coalition'},
  {value: 'other', label: 'Enter custom notes'},
];

const schema = z.object({
  creditAmount: z
    .number()
    .nullable()
    .refine(
      (value): value is number => value !== null && value !== 0,
      'Enter a non-zero credit amount'
    ),
  ticketUrl: z.string(),
  notes: z.string(),
  customNotes: z.string().max(500),
});

interface AddToStartupProgramModalProps extends ModalRenderProps {
  onSuccess: () => void;
  orgId: string;
  subscription: Subscription;
}

function AddToStartupProgramModal({
  orgId,
  onSuccess,
  subscription,
  closeModal,
  Header,
  Body,
  Footer,
}: AddToStartupProgramModalProps) {
  const mutation = useMutation({
    mutationFn: (data: {creditAmount: number; notes: string; ticketUrl: string}) =>
      fetchMutation({
        method: 'POST',
        url: getApiUrl('/_admin/customers/$organizationIdOrSlug/balance-changes/', {
          path: {organizationIdOrSlug: orgId},
        }),
        data: {...data, creditAmount: data.creditAmount * 100},
      }),
    onSuccess: () => {
      addSuccessMessage('Customer added to startup program');
      onSuccess();
      closeModal();
    },
  });

  const defaultValues: z.input<typeof schema> = {
    creditAmount: 5000,
    ticketUrl: '',
    notes: 'sentryforstartups',
    customNotes: '',
  };
  const form = useScrapsForm({
    defaultValues,
    validators: defaultFormValidators(schema),
    onSubmit: ({value, createValidationError}) => {
      const parsed = schema.parse(value);
      return mutation
        .mutateAsync({
          creditAmount: parsed.creditAmount,
          ticketUrl: parsed.ticketUrl,
          notes: parsed.notes === 'other' ? parsed.customNotes : parsed.notes,
        })
        .catch(error => {
          if (error instanceof RequestError) {
            const fields = requestErrorToFieldErrors(error, value);
            if (fields) {
              return createValidationError({fields});
            }
          }
          addErrorMessage('Unable to add customer to startup program.');
          return;
        });
    },
  });

  return (
    <ScrapsForm form={form}>
      <Header>
        <Heading as="h2">Add to Startup Program</Heading>
      </Header>
      <Body>
        <Stack gap="lg">
          <Text>
            <Text bold>Current Balance: </Text>
            {formatBalance(subscription.accountBalance)}
          </Text>
          <form.Field name="creditAmount">
            {field => (
              <field.Layout.Stack
                label="Credit Amount"
                hintText="Add or remove credit, in dollars"
                required
              >
                <field.Number
                  value={field.value}
                  onChange={field.handleChange}
                  disabled={mutation.isPending}
                />
              </field.Layout.Stack>
            )}
          </form.Field>
          <form.Field name="ticketUrl">
            {field => (
              <field.Layout.Stack label="Ticket URL">
                <field.Input
                  type="url"
                  value={field.value}
                  onChange={field.handleChange}
                  disabled={mutation.isPending}
                />
              </field.Layout.Stack>
            )}
          </form.Field>
          <form.Field name="notes">
            {field => (
              <field.Layout.Stack label="Notes">
                <field.Select
                  value={field.value}
                  onChange={field.handleChange}
                  options={STARTUP_PROGRAM_OPTIONS}
                  disabled={mutation.isPending}
                />
              </field.Layout.Stack>
            )}
          </form.Field>
          <form.Subscribe selector={state => state.values.notes}>
            {notes =>
              notes === 'other' ? (
                <form.Field name="customNotes">
                  {field => (
                    <field.Layout.Stack label="Custom Notes">
                      <field.Input
                        value={field.value}
                        onChange={field.handleChange}
                        maxLength={500}
                        disabled={mutation.isPending}
                      />
                    </field.Layout.Stack>
                  )}
                </form.Field>
              ) : null
            }
          </form.Subscribe>
        </Stack>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal}>Cancel</Button>
          <form.SubmitButton>Submit</form.SubmitButton>
        </Flex>
      </Footer>
    </ScrapsForm>
  );
}

export const triggerAddToStartupProgramModal = (
  opts: Omit<AddToStartupProgramModalProps, keyof ModalRenderProps>
) => openModal(deps => <AddToStartupProgramModal {...deps} {...opts} />);
