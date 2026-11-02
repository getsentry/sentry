import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import {useMutation} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Container, Grid} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t, tct} from 'sentry/locale';
import type {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

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

type UpdateError = undefined | Error | string | Record<string, string | string[]>;

function getUpdateErrorFromResponse(
  responseJSON: RequestError['responseJSON'],
  fallback: string
): UpdateError {
  if (!responseJSON || typeof responseJSON !== 'object') {
    return fallback;
  }

  // APIException-style responses (e.g. 402 for a missing payment method) return
  // a single string `detail` rather than a map of field errors.
  const {detail} = responseJSON;
  if (typeof detail === 'string') {
    return detail;
  }
  if (detail && typeof detail === 'object') {
    return typeof detail.message === 'string' ? detail.message : fallback;
  }

  return responseJSON as Record<string, string | string[]>;
}

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
      ([field, errors]: [string, string | string[]]) => {
        return (
          <li key={field}>
            <strong>{field}</strong>{' '}
            {Array.isArray(errors) ? errors.join(' ') : String(errors)}
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

export function SpendLimitsEditModal({
  Footer,
  closeModal,
  organization,
  subscription,
}: Props) {
  const [currentOnDemandBudget] = useState<OnDemandBudgets>(() => ({
    ...parseOnDemandBudgetsFromSubscription(subscription),
  }));
  const [onDemandBudget, setOnDemandBudget] = useState<OnDemandBudgets>(() =>
    parseOnDemandBudgetsFromSubscription(subscription)
  );
  const [updateError, setUpdateError] = useState<UpdateError>(undefined);

  const {mutate: saveOnDemandBudget} = useMutation({
    mutationFn: (data: OnDemandBudgets) =>
      fetchMutation({
        url: getApiUrl('/customers/$organizationIdOrSlug/ondemand-budgets/', {
          path: {organizationIdOrSlug: subscription.slug},
        }),
        method: 'POST',
        data,
      }),
    onSuccess: (_resp, newOnDemandBudget) => {
      SubscriptionStore.loadData(subscription.slug);
      trackOnDemandBudgetAnalytics(
        organization,
        currentOnDemandBudget,
        newOnDemandBudget
      );

      if (getTotalBudget(newOnDemandBudget) > 0) {
        addSuccessMessage(t('Budget updated'));
      } else {
        addSuccessMessage(t('Budget turned off'));
      }

      closeModal();
    },
    onError: error => {
      const saveError = getBudgetSaveError(subscription.planDetails);
      setUpdateError(
        error instanceof RequestError
          ? getUpdateErrorFromResponse(error.responseJSON, saveError)
          : saveError
      );
      addErrorMessage(saveError);
    },
  });

  const handleSave = () => {
    const newOnDemandBudget = normalizeOnDemandBudget(onDemandBudget);

    if (exceedsInvoicedBudgetLimit(subscription, newOnDemandBudget)) {
      const message = getBudgetExceededInvoicedLimitError(subscription.planDetails);
      setUpdateError(message);
      addErrorMessage(message);
      return;
    }

    saveOnDemandBudget(newOnDemandBudget);
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
      <Container
        css={theme => css`
          margin: -${theme.space['2xl']};

          @container (min-width: ${theme.container['3xl']}) {
            margin-inline: -${theme.space['3xl']};
          }
        `}
      >
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
      </Container>
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
