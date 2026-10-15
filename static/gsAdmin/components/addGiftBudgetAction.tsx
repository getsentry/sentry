import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import type {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';

import type {Subscription} from 'getsentry/types';
import {getPlanCategoryName} from 'getsentry/utils/dataCategory';

type Props = {
  onSuccess: () => void;
  organization: Organization;
  subscription: Subscription;
};

type ModalProps = Props & ModalRenderProps;

const schema = z.object({
  selectedBudgetId: z.string().min(1, 'Select a reserved budget'),
  giftAmount: z.number().positive().max(10000),
  ticketUrl: z.union([z.literal(''), z.url()]),
  notes: z.string().min(1).max(500),
});

function AddGiftBudgetModal({
  onSuccess,
  organization,
  subscription,
  closeModal,
  Header,
  Body,
  Footer,
}: ModalProps) {
  const reservedBudgetOptions =
    subscription.reservedBudgets?.filter(b => b.reservedBudget > 0) ?? [];

  const mutation = useMutation({
    mutationFn: (value: z.infer<typeof schema>) => {
      const selectedBudget = reservedBudgetOptions.find(
        budget => budget.id === value.selectedBudgetId
      );

      return fetchMutation({
        url: getApiUrl('/customers/$organizationIdOrSlug/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        method: 'PUT',
        data: {
          freeReservedBudget: {
            id: value.selectedBudgetId,
            freeBudget: value.giftAmount * 100,
            categories: Object.keys(selectedBudget?.categories ?? []),
          },
          ticketUrl: value.ticketUrl || null,
          notes: value.notes,
        },
      });
    },
    onSuccess: () => {
      addSuccessMessage('Added gifted budget amount.');
      closeModal();
      onSuccess();
    },
    onError: () => addErrorMessage('Unable to add gifted budget amount for org.'),
  });
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      selectedBudgetId: reservedBudgetOptions[0]?.id ?? '',
      giftAmount: 0,
      ticketUrl: '',
      notes: '',
    },
    validators: {onDynamic: schema},
    onSubmit: ({value}) => mutation.mutateAsync(value).catch(() => {}),
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h2">Add Gift Budget</Heading>
      </Header>
      <Body>
        <form.AppField name="selectedBudgetId">
          {budgetField => (
            <Stack gap="md">
              {reservedBudgetOptions.length > 1 && (
                <Text as="p">Select a reserved budget to add gift amount.</Text>
              )}
              {reservedBudgetOptions.length === 0 && (
                <Text as="p">No reserved budgets available.</Text>
              )}
              {reservedBudgetOptions.map(budget => (
                <Container
                  key={budget.id}
                  padding="xl"
                  border="primary"
                  radius="md"
                  background={
                    budgetField.state.value === budget.id ? 'secondary' : undefined
                  }
                  cursor="pointer"
                  onClick={() => budgetField.handleChange(budget.id)}
                >
                  <Stack gap="md">
                    <Flex justify="between">
                      <Text>
                        <Text bold>Reserved Budget:</Text> $
                        {(budget.reservedBudget / 100).toLocaleString()}
                      </Text>
                      <Text>
                        <Text bold>Existing Free Budget:</Text> $
                        {(budget.freeBudget / 100).toLocaleString()}
                      </Text>
                    </Flex>
                    <Text>
                      <Text bold>Categories:</Text>{' '}
                      {Object.keys(budget.categories)
                        .map(category =>
                          getPlanCategoryName({
                            plan: subscription.planDetails,
                            category: category as DataCategory,
                            capitalize: false,
                            hadCustomDynamicSampling: true,
                          })
                        )
                        .join(', ') || 'None'}
                    </Text>
                    {budgetField.state.value === budget.id && (
                      <form.AppField name="giftAmount">
                        {field => (
                          <field.Layout.Stack
                            label="Gift Amount ($)"
                            hintText="Enter gift amount in dollars (max $10,000)."
                            required
                          >
                            <field.Number
                              min={0}
                              max={10000}
                              value={field.state.value}
                              onChange={value => field.handleChange(value ?? 0)}
                              onClick={(event: React.MouseEvent) =>
                                event.stopPropagation()
                              }
                            />
                            <Text>Total Gift: ${field.state.value.toLocaleString()}</Text>
                          </field.Layout.Stack>
                        )}
                      </form.AppField>
                    )}
                  </Stack>
                </Container>
              ))}
            </Stack>
          )}
        </form.AppField>
        <Stack gap="lg" marginTop="xl">
          <form.AppField name="ticketUrl">
            {field => (
              <field.Layout.Stack label="Ticket URL">
                <field.Input
                  type="url"
                  value={field.state.value}
                  onChange={field.handleChange}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="notes">
            {field => (
              <field.Layout.Stack label="Notes" required>
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  maxLength={500}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
        </Stack>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal}>Cancel</Button>
          <form.SubmitButton>Confirm</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}

type Options = Pick<Props, 'onSuccess' | 'organization' | 'subscription'>;

export const addGiftBudgetAction = (opts: Options) => {
  return openModal(deps => <AddGiftBudgetModal {...deps} {...opts} />, {
    closeEvents: 'escape-key',
  });
};
