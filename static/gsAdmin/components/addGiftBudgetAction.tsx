import {Fragment, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import InputField from 'sentry/components/forms/fields/inputField';
import NumberField from 'sentry/components/forms/fields/numberField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import {space} from 'sentry/styles/space';
import type {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';

import type {Subscription} from 'getsentry/types';
import {getPlanCategoryName} from 'getsentry/utils/dataCategory';

type Props = {
  onSuccess: () => void;
  organization: Organization;
  subscription: Subscription;
};

type ModalProps = Props & ModalRenderProps;

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
  const [giftAmount, setGiftAmount] = useState<number>(0);
  const [ticketUrl, setTicketUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);

  const reservedBudgetOptions = useMemo(
    () => subscription.reservedBudgets?.filter(b => b.reservedBudget > 0) ?? [],
    [subscription.reservedBudgets]
  );

  useEffect(() => {
    if (reservedBudgetOptions.length > 0 && !selectedBudgetId) {
      setSelectedBudgetId(reservedBudgetOptions[0]?.id ?? null);
    }
  }, [reservedBudgetOptions, selectedBudgetId]);

  const onSubmit = () => {
    if (!selectedBudgetId || giftAmount <= 0) {
      return;
    }

    const selectedBudget = reservedBudgetOptions.find(
      budget => budget.id === selectedBudgetId
    );

    const data = {
      freeReservedBudget: {
        id: selectedBudgetId,
        freeBudget: giftAmount * 100, // convert to cents
        categories: Object.keys(selectedBudget?.categories ?? []),
      },
      ticketUrl,
      notes,
    };

    api.request(`/customers/${organization.slug}/`, {
      method: 'PUT',
      data,
      success: () => {
        addSuccessMessage('Added gifted budget amount.');
        closeModal();
        onSuccess();
      },
      error: () => {
        addErrorMessage('Unable to add gifted budget amount for org.');
      },
    });
  };

  function getHelp() {
    return `Total Gift: $${giftAmount.toLocaleString()}`;
  }

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
        <Form onSubmit={onSubmit} submitLabel="Confirm" onCancel={closeModal}>
          {reservedBudgetOptions.map(budget => (
            <BudgetCard
              key={budget.id}
              isSelected={selectedBudgetId === budget.id}
              onClick={() => setSelectedBudgetId(budget.id)}
            >
              <BudgetHeader>
                <div>
                  <strong>Reserved Budget:</strong> $
                  {(budget.reservedBudget / 100).toLocaleString()}
                </div>
                <div>
                  <strong>Existing Free Budget:</strong> $
                  {(budget.freeBudget / 100).toLocaleString()}
                </div>
              </BudgetHeader>
              <BudgetCategories>
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
              </BudgetCategories>
              {selectedBudgetId === budget.id && (
                <NumberField
                  inline={false}
                  stacked
                  flexibleControlStateSize
                  label="Gift Amount ($)"
                  help={
                    <Fragment>
                      <Fragment>Enter gift amount in dollars (max $10,000).</Fragment>
                      <br />
                      <Fragment>{getHelp()}</Fragment>
                    </Fragment>
                  }
                  name="giftAmount"
                  value={giftAmount}
                  defaultValue={0}
                  onChange={(value: number) => {
                    const clampedValue = Math.min(10000, Math.max(0, value));
                    setGiftAmount(clampedValue);
                  }}
                  required
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                />
              )}
            </BudgetCard>
          ))}
          {reservedBudgetOptions.length === 0 && (
            <div>No reserved budgets available.</div>
          )}
          <AuditFields>
            <InputField
              data-test-id="url-field"
              name="ticket-url"
              type="url"
              label="TicketUrl"
              inline={false}
              stacked
              flexibleControlStateSize
              onChange={(ticketUrlInput: any) => setTicketUrl(ticketUrlInput)}
            />
            <TextField
              data-test-id="notes-field"
              name="notes"
              label="Notes"
              inline={false}
              stacked
              flexibleControlStateSize
              maxLength={500}
              required // serializer requires this to be present
              onChange={(notesInput: any) => setNotes(notesInput)}
            />
          </AuditFields>
        </Form>
      </Body>
    </Fragment>
  );
}

type Options = Pick<Props, 'onSuccess' | 'organization' | 'subscription'>;

const addGiftBudgetAction = (opts: Options) => {
  return openModal(deps => <AddGiftBudgetModal {...deps} {...opts} />, {
    closeEvents: 'escape-key',
  });
};

export default addGiftBudgetAction;

const BudgetCard = styled('div')<{isSelected: boolean}>`
  padding: ${space(2)};
  margin: ${space(1)} 0;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.radius.md};
  background-color: ${p => (p.isSelected ? p.theme.colors.surface200 : 'transparent')};
  cursor: pointer;
`;

const BudgetHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${space(1)};
`;

const BudgetCategories = styled('div')`
  margin-bottom: ${space(1)};
`;

const AuditFields = styled('div')`
  margin-top: ${space(2)};
`;
