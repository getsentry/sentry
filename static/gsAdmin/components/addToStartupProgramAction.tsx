import {Fragment} from 'react';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
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
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: async ({value, formApi}) => {
      try {
        const parsed = schema.parse(value);
        await mutation.mutateAsync({
          creditAmount: parsed.creditAmount,
          ticketUrl: parsed.ticketUrl,
          notes: parsed.notes === 'other' ? parsed.customNotes : parsed.notes,
        });
      } catch (error) {
        const handled =
          error instanceof RequestError &&
          setFieldErrors(formApi, requestErrorToFieldErrors(error, formApi.state.values));
        if (!handled) {
          addErrorMessage('Unable to add customer to startup program.');
        }
      }
    },
  });

  return (
    <Fragment>
      <form.AppForm form={form}>
        <Header>
          <Heading as="h2">Add to Startup Program</Heading>
        </Header>
        <Body>
          <Stack gap="lg">
            <Text data-test-id="balance">
              <Text bold>Current Balance: </Text>
              {formatBalance(subscription.accountBalance)}
            </Text>
            <form.AppField name="creditAmount">
              {field => (
                <field.Layout.Stack
                  label="Credit Amount"
                  hintText="Add or remove credit, in dollars"
                  required
                >
                  <field.Number
                    value={field.state.value}
                    onChange={field.handleChange}
                    disabled={mutation.isPending}
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
            <form.AppField name="ticketUrl">
              {field => (
                <field.Layout.Stack label="Ticket URL">
                  <field.Input
                    type="url"
                    value={field.state.value}
                    onChange={field.handleChange}
                    disabled={mutation.isPending}
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
            <form.AppField name="notes">
              {field => (
                <field.Layout.Stack label="Notes">
                  <field.Select
                    value={field.state.value}
                    onChange={field.handleChange}
                    options={STARTUP_PROGRAM_OPTIONS}
                    disabled={mutation.isPending}
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
            <form.Subscribe selector={state => state.values.notes}>
              {notes =>
                notes === 'other' ? (
                  <form.AppField name="customNotes">
                    {field => (
                      <field.Layout.Stack label="Custom Notes">
                        <field.Input
                          value={field.state.value}
                          onChange={field.handleChange}
                          maxLength={500}
                          disabled={mutation.isPending}
                        />
                      </field.Layout.Stack>
                    )}
                  </form.AppField>
                ) : null
              }
            </form.Subscribe>
          </Stack>
        </Body>
        <Footer>
          <Flex gap="md" justify="end">
            <Button onClick={closeModal}>Cancel</Button>
            <form.SubmitButton>
              {mutation.isPending ? 'Submitting...' : 'Submit'}
            </form.SubmitButton>
          </Flex>
        </Footer>
      </form.AppForm>
    </Fragment>
  );
}

export const triggerAddToStartupProgramModal = (
  opts: Omit<AddToStartupProgramModalProps, keyof ModalRenderProps>
) => openModal(deps => <AddToStartupProgramModal {...deps} {...opts} />);
