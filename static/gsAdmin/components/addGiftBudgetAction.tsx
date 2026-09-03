import {Fragment, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Flex, Container} from '@sentry/scraps/layout';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {InputField} from 'sentry/components/forms/fields/inputField';
import {NumberField} from 'sentry/components/forms/fields/numberField';
import {TextField} from 'sentry/components/forms/fields/textField';
import {Form} from 'sentry/components/forms/form';
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

function AddGiftBudgetModal({
  onSuccess,
  organization,
  subscription,
  closeModal,
  Header,
  Body,
}: ModalProps) {
  const api = useApi();
  const [selectedBudgetApiName, setSelectedBudgetApiName] = useState<string | null>(null);
  const [giftAmount, setGiftAmount] = useState(0);
  const [ticketUrl, setTicketUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);

  const reservedBudgetOptions = useMemo(
    () => subscription.reservedBudgets?.filter(b => b.reservedBudget > 0) ?? [],
    [subscription.reservedBudgets]
  );

  useEffect(() => {
    if (reservedBudgetOptions.length > 0 && !selectedBudgetApiName) {
      setSelectedBudgetApiName(reservedBudgetOptions[0]?.apiName ?? null);
    }
  }, [reservedBudgetOptions, selectedBudgetApiName]);

  const onSubmit = () => {
    if (!selectedBudgetApiName || giftAmount <= 0) {
      return;
    }

    const selectedBudget = reservedBudgetOptions.find(
      budget => budget.apiName === selectedBudgetApiName
    );
    if (!selectedBudget) {
      return;
    }

    const data = {
      freeReservedBudget: {
        apiName: selectedBudget.apiName,
        freeBudget: giftAmount * 100, // convert to cents
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
              isSelected={selectedBudgetApiName === budget.apiName}
              onClick={() => setSelectedBudgetApiName(budget.apiName)}
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
              {selectedBudgetApiName === budget.apiName && (
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
          <Container marginTop="xl">
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
          </Container>
        </Form>
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
