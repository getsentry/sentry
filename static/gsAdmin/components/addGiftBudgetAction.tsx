import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import type {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {useApi} from 'sentry/utils/useApi';

import type {Subscription} from 'getsentry/types';
import {getPlanCategoryName} from 'getsentry/utils/dataCategory';

type Props = {
  onSuccess: () => void;
  organization: Organization;
  subscription: Subscription;
};

type ModalProps = Props & ModalRenderProps;

const schema = z.object({
  giftAmount: z.number().positive().max(10000),
  ticketUrl: z.string(),
  notes: z.string().min(1).max(500),
});

function AddGiftBudgetModal({
  onSuccess,
  organization,
  subscription,
  closeModal,
  Header,
  Body,
}: ModalProps) {
  const api = useApi();
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);

  const reservedBudgetOptions = useMemo(
    () => subscription.reservedBudgets?.filter(b => b.reservedBudget > 0) ?? [],
    [subscription.reservedBudgets]
  );

  const activeBudgetId = selectedBudgetId ?? reservedBudgetOptions[0]?.id ?? null;
  const mutation = useMutation({
    mutationFn: (value: z.infer<typeof schema>) => {
      if (!activeBudgetId) {
        throw new Error('A reserved budget is required');
      }

      const selectedBudget = reservedBudgetOptions.find(
        budget => budget.id === activeBudgetId
      );

      return api.requestPromise(`/customers/${organization.slug}/`, {
        method: 'PUT',
        data: {
          freeReservedBudget: {
            id: activeBudgetId,
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
    defaultValues: {giftAmount: 0, ticketUrl: '', notes: ''},
    validators: {onDynamic: schema},
    onSubmit: ({value}) => mutation.mutateAsync(value).catch(() => {}),
  });

  return (
    <Fragment>
      <Header closeButton>Add Gift Budget</Header>
      <Body>
        {reservedBudgetOptions.length > 1 ? (
          <Fragment>
            <div>Select a reserved budget to add gift amount.</div>
            <br />
          </Fragment>
        ) : reservedBudgetOptions.length === 0 ? (
          <div>No reserved budgets available.</div>
        ) : (
          <div />
        )}
        <form.AppForm form={form}>
          {reservedBudgetOptions.map(budget => (
            <BudgetCard
              key={budget.id}
              isSelected={activeBudgetId === budget.id}
              onClick={() => setSelectedBudgetId(budget.id)}
            >
              <Flex justify="between" marginBottom="md">
                <div>
                  <strong>Reserved Budget:</strong> $
                  {(budget.reservedBudget / 100).toLocaleString()}
                </div>
                <div>
                  <strong>Existing Free Budget:</strong> $
                  {(budget.freeBudget / 100).toLocaleString()}
                </div>
              </Flex>
              <Container marginBottom="md">
                <strong>Categories:</strong>{' '}
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
              </Container>
              {activeBudgetId === budget.id && (
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
                        onClick={(event: React.MouseEvent) => event.stopPropagation()}
                      />
                      <Text>Total Gift: ${field.state.value.toLocaleString()}</Text>
                    </field.Layout.Stack>
                  )}
                </form.AppField>
              )}
            </BudgetCard>
          ))}
          {reservedBudgetOptions.length === 0 && (
            <div>No reserved budgets available.</div>
          )}
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
            <Flex gap="md" justify="end">
              <Button onClick={closeModal}>Cancel</Button>
              <form.SubmitButton>Confirm</form.SubmitButton>
            </Flex>
          </Stack>
        </form.AppForm>
      </Body>
    </Fragment>
  );
}

type Options = Pick<Props, 'onSuccess' | 'organization' | 'subscription'>;

export const addGiftBudgetAction = (opts: Options) => {
  return openModal(deps => <AddGiftBudgetModal {...deps} {...opts} />, {
    closeEvents: 'escape-key',
  });
};

const BudgetCard = styled('div')<{isSelected: boolean}>`
  padding: ${p => p.theme.space.xl};
  margin: ${p => p.theme.space.md} 0;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  background-color: ${p => (p.isSelected ? p.theme.colors.surface200 : 'transparent')};
  cursor: pointer;
`;
