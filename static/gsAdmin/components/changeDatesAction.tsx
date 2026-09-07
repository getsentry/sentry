import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal, type ModalRenderProps} from 'sentry/actionCreators/modal';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';

import type {Subscription} from 'getsentry/types';

const schema = z.object({
  onDemandPeriodStart: z.string(),
  onDemandPeriodEnd: z.string(),
  contractPeriodStart: z.string(),
  contractPeriodEnd: z.string(),
});

type FormValues = z.infer<typeof schema>;

interface ChangeDatesModalProps extends ModalRenderProps {
  onSuccess: () => void;
  orgId: string;
  subscription: Subscription;
}

function ChangeDatesModal({
  orgId,
  subscription,
  onSuccess,
  closeModal,
  Header,
  Body,
  Footer,
}: ChangeDatesModalProps) {
  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      fetchMutation({
        url: getApiUrl('/customers/$organizationIdOrSlug/', {
          path: {organizationIdOrSlug: orgId},
        }),
        method: 'PUT',
        data: Object.fromEntries(
          Object.entries(data).filter(([, value]) => value !== '')
        ),
      }),
    onSuccess: () => {
      addSuccessMessage('Contract and on-demand period dates updated');
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
      addErrorMessage('Unable to update subscription dates.');
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      onDemandPeriodStart: subscription.onDemandPeriodStart ?? '',
      onDemandPeriodEnd: subscription.onDemandPeriodEnd ?? '',
      contractPeriodStart: subscription.billingPeriodStart ?? '',
      contractPeriodEnd: subscription.billingPeriodEnd ?? '',
    },
    validators: {onDynamic: schema},
    onSubmit: ({value}) => mutation.mutateAsync(value).catch(() => {}),
  });

  const dateFields = [
    {
      name: 'onDemandPeriodStart' as const,
      label: 'On-Demand Period Start Date',
      hintText: 'The new start date for the on-demand period. Leave blank to keep it.',
    },
    {
      name: 'onDemandPeriodEnd' as const,
      label: 'On-Demand Period End Date',
      hintText: 'The new end date for the on-demand period. Leave blank to keep it.',
    },
    {
      name: 'contractPeriodStart' as const,
      label: 'Contract Period Start Date',
      hintText: 'The new start date for the contract period. Leave blank to keep it.',
    },
    {
      name: 'contractPeriodEnd' as const,
      label: 'Contract Period End Date',
      hintText: 'The new end date for the contract period. Leave blank to keep it.',
    },
  ];

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h3">Change Contract and Current On-Demand Period Dates</Heading>
      </Header>
      <Body>
        <Stack gap="lg">
          <Alert.Container>
            <Alert variant="info" showIcon={false}>
              This overrides the current contract and on-demand period dates so the
              subscription may fall into a weird state.
            </Alert>
          </Alert.Container>
          <Text>
            To end the contract period immediately, use the "End Billing Period
            Immediately" action.
          </Text>
          {dateFields.map(({name, label, hintText}) => (
            <form.AppField key={name} name={name}>
              {field => (
                <field.Layout.Stack label={label} hintText={hintText}>
                  <field.Input
                    type="date"
                    value={field.state.value}
                    onChange={field.handleChange}
                    disabled={mutation.isPending}
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
          ))}
        </Stack>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal}>Cancel</Button>
          <form.SubmitButton>Submit</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}

type Options = Omit<ChangeDatesModalProps, keyof ModalRenderProps>;

export const triggerChangeDatesModal = (opts: Options) =>
  openModal(deps => <ChangeDatesModal {...deps} {...opts} />);
