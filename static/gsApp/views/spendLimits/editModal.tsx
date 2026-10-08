import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Container, Grid} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t, tct} from 'sentry/locale';
import type {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {useApi} from 'sentry/utils/useApi';

import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import type {OnDemandBudgets, Plan, Subscription} from 'getsentry/types';
import {displayBudgetName} from 'getsentry/utils/billing';
import {EmbeddedSpendLimitSettings} from 'getsentry/views/spendLimits/embeddedSettings';

import {
  exceedsInvoicedBudgetLimit,
  getTotalBudget,
  normalizeOnDemandBudget,
  parseOnDemandBudgetsFromSubscription,
  trackOnDemandBudgetAnalytics,
} from './utils';

function getBudgetSaveError(plan: Plan) {
  return t(
    'Unable to save your %s',
    displayBudgetName(plan, {
      pluralOndemand: true,
      withBudget: true,
    })
  );
}

function getBudgetExceededInvoicedLimitError(plan: Plan) {
  return t(
    'Your %s cannot exceed 5 times your monthly plan price.',
    displayBudgetName(plan, {withBudget: true})
  );
}

type UpdateError = undefined | Error | string | Record<string, string[]>;

type Props = {
  organization: Organization;
  subscription: Subscription;
} & ModalRenderProps;

function BudgetUpdateError({error, plan}: {error: UpdateError; plan: Plan}) {
  if (!error) {
    return null;
  }

  if (!(error instanceof Error) && typeof error === 'object') {
    const listOfErrors = Object.entries(error).map(
      ([field, errors]: [string, string[]]) => {
        return (
          <li key={field}>
            <strong>{field}</strong> {errors.join(' ')}
          </li>
        );
      }
    );

    if (listOfErrors.length === 0) {
      return (
        <Alert system variant="danger">
          {getBudgetSaveError(plan)}
        </Alert>
      );
    }

    return (
      <Alert system variant="danger">
        <ul>{listOfErrors}</ul>
      </Alert>
    );
  }

  return (
    <Alert system variant="danger">
      {/* TODO(TS): Type says error might be an object */}
      {error as React.ReactNode}
    </Alert>
  );
}

function SpendLimitsEditModal({Footer, closeModal, organization, subscription}: Props) {
  const api = useApi();

  const [currentOnDemandBudget] = useState<OnDemandBudgets>(() => ({
    ...parseOnDemandBudgetsFromSubscription(subscription),
  }));
  const [onDemandBudget, setOnDemandBudget] = useState<OnDemandBudgets>(() =>
    parseOnDemandBudgetsFromSubscription(subscription)
  );
  const [updateError, setUpdateError] = useState<UpdateError>(undefined);

  const saveOnDemandBudget = async (
    ondemandBudget: OnDemandBudgets
  ): Promise<boolean> => {
    try {
      await api.requestPromise(`/customers/${subscription.slug}/ondemand-budgets/`, {
        method: 'POST',
        data: ondemandBudget,
      });
      SubscriptionStore.loadData(subscription.slug);
      return true;
    } catch (response: any) {
      setUpdateError(
        response?.responseJSON ?? getBudgetSaveError(subscription.planDetails)
      );
      addErrorMessage(getBudgetSaveError(subscription.planDetails));
      return false;
    }
  };

  const handleSave = () => {
    const newOnDemandBudget = normalizeOnDemandBudget(onDemandBudget);

    if (exceedsInvoicedBudgetLimit(subscription, newOnDemandBudget)) {
      const message = getBudgetExceededInvoicedLimitError(subscription.planDetails);
      setUpdateError(message);
      addErrorMessage(message);
      return;
    }

    saveOnDemandBudget(newOnDemandBudget).then(saveSuccess => {
      if (saveSuccess) {
        trackOnDemandBudgetAnalytics(
          organization,
          currentOnDemandBudget,
          newOnDemandBudget
        );

        if (getTotalBudget(onDemandBudget) > 0) {
          addSuccessMessage(t('Budget updated'));
        } else {
          addSuccessMessage(t('Budget turned off'));
        }

        closeModal();
      }
    });
  };

  const addOnDataCategories = Object.values(
    subscription.planDetails.addOnCategories
  ).flatMap(addOn => addOn.dataCategories);
  const currentReserved = Object.fromEntries(
    Object.entries(subscription.categories)
      .filter(([category]) => !addOnDataCategories.includes(category as DataCategory))
      .map(([category, categoryInfo]) => [category, categoryInfo.reserved ?? 0])
  );

  return (
    <Fragment>
      <OffsetBody>
        <BudgetUpdateError error={updateError} plan={subscription.planDetails} />
        <Container padding="2xl">
          <EmbeddedSpendLimitSettings
            organization={organization}
            subscription={subscription}
            header={
              <Heading as="h2" size="xl">
                {tct('Set your [budgetTerm] limit', {
                  budgetTerm: displayBudgetName(subscription.planDetails),
                })}
              </Heading>
            }
            activePlan={subscription.planDetails}
            initialOnDemandBudgets={parseOnDemandBudgetsFromSubscription(subscription)}
            currentReserved={currentReserved}
            addOns={subscription.addOns ?? {}}
            onUpdate={({onDemandBudgets}) => {
              setOnDemandBudget(onDemandBudgets);
            }}
          />
        </Container>
      </OffsetBody>
      <Footer>
        <Grid flow="column" align="center" gap="md">
          <Button onClick={() => closeModal()}>{t('Cancel')}</Button>
          <Button variant="primary" onClick={handleSave}>
            {t('Save')}
          </Button>
        </Grid>
      </Footer>
    </Fragment>
  );
}

const OffsetBody = styled('div')`
  margin: -${p => p.theme.space['2xl']} -${p => p.theme.space['3xl']};

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    margin: -${p => p.theme.space['2xl']};
  }
`;

export default SpendLimitsEditModal;
