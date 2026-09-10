import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Container, Grid, Stack} from '@sentry/scraps/layout';
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
import {SpendLimitSettings} from 'getsentry/views/spendLimits/spendLimitSettings';

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

type Props = {
  organization: Organization;
  subscription: Subscription;
} & ModalRenderProps;

const onDemandBudgetsSchema = z.custom<OnDemandBudgets>(value => {
  if (!value || typeof value !== 'object' || !('budgetMode' in value)) {
    return false;
  }

  if (value.budgetMode === 'shared') {
    return (
      'sharedMaxBudget' in value &&
      typeof value.sharedMaxBudget === 'number' &&
      Number.isFinite(value.sharedMaxBudget) &&
      value.sharedMaxBudget >= 0
    );
  }

  return (
    value.budgetMode === 'per_category' &&
    'budgets' in value &&
    !!value.budgets &&
    typeof value.budgets === 'object' &&
    Object.values(value.budgets).every(
      budget => typeof budget === 'number' && Number.isFinite(budget) && budget >= 0
    )
  );
}, t('Enter a valid spending limit.'));

function getFormSchema(subscription: Subscription) {
  return z.object({
    onDemandBudgets: onDemandBudgetsSchema.superRefine((onDemandBudgets, context) => {
      if (exceedsInvoicedBudgetLimit(subscription, onDemandBudgets)) {
        context.addIssue({
          code: 'custom',
          message: getBudgetExceededInvoicedLimitError(subscription.planDetails),
        });
      }
    }),
  });
}

function renderRequestError(error: Error | null, plan: Plan) {
  if (!error) {
    return null;
  }

  if (error instanceof RequestError && error.responseJSON) {
    const listOfErrors = Object.entries(error.responseJSON).map(([field, errors]) => (
      <li key={field}>
        <strong>{field}</strong>{' '}
        {Array.isArray(errors) ? errors.join(' ') : String(errors)}
      </li>
    ));

    return (
      <Alert system variant="danger">
        {listOfErrors.length > 0 ? <ul>{listOfErrors}</ul> : getBudgetSaveError(plan)}
      </Alert>
    );
  }

  return (
    <Alert system variant="danger">
      {getBudgetSaveError(plan)}
    </Alert>
  );
}

function getValidationErrorMessage(error: unknown) {
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return null;
}

function SpendLimitsEditModal({Footer, closeModal, subscription, organization}: Props) {
  const [currentOnDemandBudget] = useState(() =>
    parseOnDemandBudgetsFromSubscription(subscription)
  );

  const mutation = useMutation({
    mutationFn: (onDemandBudgets: OnDemandBudgets) =>
      fetchMutation({
        url: getApiUrl('/customers/$organizationIdOrSlug/ondemand-budgets/', {
          path: {organizationIdOrSlug: subscription.slug},
        }),
        method: 'POST',
        data: onDemandBudgets,
      }),
    onError: () => {
      addErrorMessage(getBudgetSaveError(subscription.planDetails));
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {onDemandBudgets: currentOnDemandBudget},
    validators: {onDynamic: getFormSchema(subscription)},
    onSubmit: async ({value}) => {
      const newOnDemandBudget = normalizeOnDemandBudget(value.onDemandBudgets);
      try {
        await mutation.mutateAsync(newOnDemandBudget);
      } catch {
        return;
      }

      SubscriptionStore.loadData(subscription.slug);
      trackOnDemandBudgetAnalytics(
        organization,
        currentOnDemandBudget,
        newOnDemandBudget
      );
      addSuccessMessage(
        getTotalBudget(newOnDemandBudget) > 0
          ? t('Budget updated')
          : t('Budget turned off')
      );
      closeModal();
    },
  });

  const addOnDataCategories = Object.values(
    subscription.planDetails.addOnCategories
  ).flatMap(addOn => addOn.dataCategories);
  const currentReserved = Object.fromEntries(
    Object.entries(subscription.categories)
      .filter(([category]) => !addOnDataCategories.includes(category as DataCategory))
      .map(([category, categoryInfo]) => [category, categoryInfo.reserved ?? 0])
  );

  return (
    <form.AppForm form={form}>
      <Fragment>
        <OffsetBody>
          {renderRequestError(mutation.error, subscription.planDetails)}
          <Container padding="2xl">
            <form.AppField name="onDemandBudgets">
              {field => {
                const validationError = getValidationErrorMessage(
                  field.state.meta.errors[0]
                );
                return (
                  <Stack gap="lg">
                    {validationError && (
                      <Alert system variant="danger">
                        {validationError}
                      </Alert>
                    )}
                    <SpendLimitSettings
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
                      onDemandBudgets={field.state.value}
                      currentReserved={currentReserved}
                      addOns={subscription.addOns ?? {}}
                      onUpdate={({onDemandBudgets}) =>
                        field.handleChange(onDemandBudgets)
                      }
                    />
                  </Stack>
                );
              }}
            </form.AppField>
          </Container>
        </OffsetBody>
        <Footer>
          <Grid flow="column" align="center" gap="md">
            <Button onClick={closeModal}>{t('Cancel')}</Button>
            <form.SubmitButton>{t('Save')}</form.SubmitButton>
          </Grid>
        </Footer>
      </Fragment>
    </form.AppForm>
  );
}

const OffsetBody = styled('div')`
  margin: -${p => p.theme.space['2xl']} -${p => p.theme.space['3xl']};

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    margin: -${p => p.theme.space['2xl']};
  }
`;

export default SpendLimitsEditModal;
