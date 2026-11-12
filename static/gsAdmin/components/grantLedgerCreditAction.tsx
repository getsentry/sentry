import {Fragment} from 'react';
import {useMutation, useQuery} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {openModal, type ModalRenderProps} from '@sentry/scraps/modal';
import {Heading, Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';

import {displayPriceWithCents} from 'getsentry/utils/billing';

const MAX_CLIENT_KEY_LENGTH = 16;
const CLIENT_KEY_PATTERN = /^[\w-]+$/;

type LedgerLineItem = {
  balanceCents: number;
  name: string;
  uid: string;
};

const schema = z
  .object({
    lineItemUid: z.string().min(1, 'Select a credit-only line item'),
    amount: z
      .number()
      .nullable()
      .refine(
        (value): value is number => value !== null && value > 0,
        'Enter a positive amount'
      ),
    multipleGrantsToday: z.boolean(),
    clientKey: z.string(),
    ticketUrl: z.string(),
    notes: z.string().max(500),
  })
  .superRefine((value, ctx) => {
    if (!value.multipleGrantsToday) {
      return;
    }
    if (!value.clientKey) {
      ctx.addIssue({
        code: 'custom',
        path: ['clientKey'],
        message: 'Enter a client key to tell this grant apart from earlier ones today',
      });
    } else if (value.clientKey.length > MAX_CLIENT_KEY_LENGTH) {
      ctx.addIssue({
        code: 'custom',
        path: ['clientKey'],
        message: `Use at most ${MAX_CLIENT_KEY_LENGTH} characters`,
      });
    } else if (!CLIENT_KEY_PATTERN.test(value.clientKey)) {
      ctx.addIssue({
        code: 'custom',
        path: ['clientKey'],
        message: 'Use only letters, numbers, dashes, and underscores',
      });
    }
  });

type GrantData = {
  amount: number;
  lineItemUid: string;
  multipleGrantsToday: boolean;
  notes: string;
  ticketUrl: string;
  clientKey?: string;
};

interface GrantLedgerCreditModalProps extends ModalRenderProps {
  onSuccess: () => void;
  orgId: string;
}

function GrantLedgerCreditModal({
  orgId,
  onSuccess,
  closeModal,
  Header,
  Body,
  Footer,
}: GrantLedgerCreditModalProps) {
  const ledgerGrantsUrl = '/_admin/customers/$organizationIdOrSlug/ledger-grants/';
  const {data, isPending, isError, refetch} = useQuery(
    apiOptions.as<{lineItems: LedgerLineItem[]}>()(ledgerGrantsUrl, {
      path: {organizationIdOrSlug: orgId},
      staleTime: 0,
    })
  );

  const mutation = useMutation({
    mutationFn: (grant: GrantData) =>
      fetchMutation({
        method: 'POST',
        url: getApiUrl(ledgerGrantsUrl, {path: {organizationIdOrSlug: orgId}}),
        data: grant,
      }),
    onSuccess: () => {
      toast.success('Ledger credit granted');
      onSuccess();
      closeModal();
    },
    onError: error => {
      if (
        error instanceof RequestError &&
        setFieldErrors(form, requestErrorToFieldErrors(error, form.state.values))
      ) {
        return;
      }
      toast.error(
        error instanceof RequestError && typeof error.responseJSON?.detail === 'string'
          ? error.responseJSON.detail
          : 'Unable to grant ledger credit.'
      );
    },
  });

  const defaultValues: z.input<typeof schema> = {
    lineItemUid: '',
    amount: null,
    multipleGrantsToday: false,
    clientKey: '',
    ticketUrl: '',
    notes: '',
  };
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      const parsed = schema.parse(value);
      return mutation
        .mutateAsync({
          lineItemUid: parsed.lineItemUid,
          amount: Math.round(parsed.amount * 100),
          multipleGrantsToday: parsed.multipleGrantsToday,
          ...(parsed.multipleGrantsToday ? {clientKey: parsed.clientKey} : {}),
          ticketUrl: parsed.ticketUrl,
          notes: parsed.notes,
        })
        .catch(() => {});
    },
  });

  if (isPending || isError) {
    return (
      <Fragment>
        <Header closeButton>
          <Heading as="h2">Grant Ledger Credit</Heading>
        </Header>
        <Body>
          {isPending ? <LoadingIndicator /> : <LoadingError onRetry={refetch} />}
        </Body>
      </Fragment>
    );
  }

  const lineItemOptions = data.lineItems.map(lineItem => ({
    value: lineItem.uid,
    label: `${lineItem.name} (balance ${displayPriceWithCents({cents: lineItem.balanceCents})})`,
  }));

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h2">Grant Ledger Credit</Heading>
      </Header>
      <Body>
        <Stack gap="lg">
          <Text>
            Add free credit to a credit-only line item. The customer receives a paid
            invoice for the grant and can use the credit immediately.
          </Text>
          {lineItemOptions.length === 0 ? (
            <Text variant="muted">
              The current contract has no credit-only line items.
            </Text>
          ) : null}
          <form.AppField name="lineItemUid">
            {field => (
              <field.Layout.Stack label="Line Item" required>
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={lineItemOptions}
                  disabled={mutation.isPending || lineItemOptions.length === 0}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="amount">
            {field => (
              <field.Layout.Stack label="Amount" hintText="In dollars" required>
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
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  maxLength={500}
                  disabled={mutation.isPending}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="multipleGrantsToday">
            {field => (
              <field.Checkbox
                label="I am providing multiple grants to this customer in one day"
                hintText="Only one grant per line item is allowed each day (UTC) unless you set a client key."
                checked={field.state.value}
                onChange={field.handleChange}
                disabled={mutation.isPending}
              />
            )}
          </form.AppField>
          <form.Subscribe selector={state => state.values.multipleGrantsToday}>
            {multipleGrantsToday =>
              multipleGrantsToday ? (
                <form.AppField name="clientKey">
                  {field => (
                    <field.Layout.Stack
                      label="Client Key"
                      hintText="A key that is unique among today's grants for this line item, such as the ticket number."
                      required
                    >
                      <field.Input
                        value={field.state.value}
                        onChange={field.handleChange}
                        maxLength={MAX_CLIENT_KEY_LENGTH}
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
          <form.SubmitButton>Grant Credit</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}

export const triggerGrantLedgerCreditModal = (
  opts: Omit<GrantLedgerCreditModalProps, keyof ModalRenderProps>
) => openModal(deps => <GrantLedgerCreditModal {...deps} {...opts} />);
