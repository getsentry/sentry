import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import type {ModalRenderProps} from '@sentry/scraps/modal';
import {openModal} from '@sentry/scraps/modal';
import {Heading, Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import type {Cell} from 'sentry/types/system';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';

export type InvoicePair = {
  legacy_invoice_guid: string;
  organization_id: number;
  platform_invoice_guid: string;
};

const schema = z.object({
  reason: z.string().trim().min(1, 'Say why this mismatch is expected'),
});

export function expectedMismatchesUrl(cell: Cell) {
  return getApiUrl('/_admin/cells/$region/invoice-comparison/expected-mismatches/', {
    path: {region: cell.name},
  });
}

interface MarkExpectedMismatchModalProps extends ModalRenderProps {
  cell: Cell;
  onSuccess: () => void;
  orgLabel: string;
  pair: InvoicePair;
}

function MarkExpectedMismatchModal({
  Header,
  Body,
  Footer,
  closeModal,
  cell,
  pair,
  orgLabel,
  onSuccess,
}: MarkExpectedMismatchModalProps) {
  const mutation = useMutation({
    mutationFn: (data: {reason: string}) =>
      fetchMutation({
        method: 'POST',
        url: expectedMismatchesUrl(cell),
        data: {...pair, ...data},
        options: {host: cell.locality_url},
      }),
    onSuccess: () => {
      toast.success('Marked as an expected mismatch.');
      onSuccess();
      closeModal();
    },
    onError: () => {
      toast.error('Failed to mark as an expected mismatch.');
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {reason: ''},
    validators: {onDynamic: schema},
    onSubmit: ({value}) => mutation.mutateAsync(schema.parse(value)).catch(() => {}),
  });

  return (
    <form.AppForm form={form}>
      <Header>
        <Heading as="h2">Mark as expected mismatch</Heading>
      </Header>
      <Body>
        <Stack gap="xl">
          <Text>
            The comparison shows this invoice pair for <Text bold>{orgLabel}</Text> as{' '}
            <code>expected_mismatch</code> instead of <code>mismatch</code>. A later
            mismatch for the org still shows as <code>mismatch</code>.
          </Text>
          <form.AppField name="reason">
            {field => (
              <field.Layout.Stack label="Reason" required>
                <field.TextArea
                  value={field.state.value}
                  onChange={field.handleChange}
                  rows={3}
                  disabled={mutation.isPending}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
        </Stack>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal}>Cancel</Button>
          <form.SubmitButton>Mark expected</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}

export function openMarkExpectedMismatchModal(props: {
  cell: Cell;
  onSuccess: () => void;
  orgLabel: string;
  pair: InvoicePair;
}) {
  openModal(modalProps => <MarkExpectedMismatchModal {...modalProps} {...props} />);
}
