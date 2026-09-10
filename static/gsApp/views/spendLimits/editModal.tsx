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
import {
  OnDemandBudgetMode,
  type OnDemandBudgets,
  type Plan,
  type Subscription,
} from 'getsentry/types';
import {displayBudgetName} from 'getsentry/utils/billing';
import {
  BudgetModeSettings,
  SpendLimitInput,
  SpendLimitSettings,
} from 'getsentry/views/spendLimits/spendLimitSettings';

import {
  convertOnDemandBudget,
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

type SpendLimitFormValues = {
  budgetMode: OnDemandBudgetMode;
  budgets: Partial<Record<DataCategory, number>>;
  sharedMaxBudget: number;
};

const nonNegativeBudgetSchema = z
  .number()
  .finite()
  .nonnegative(t('Enter a valid spending limit.'));

function getFormValues(onDemandBudgets: OnDemandBudgets): SpendLimitFormValues {
  const perCategoryBudget = convertOnDemandBudget(
    onDemandBudgets,
    OnDemandBudgetMode.PER_CATEGORY
  );
  return {
    budgetMode: onDemandBudgets.budgetMode,
    sharedMaxBudget: getTotalBudget(onDemandBudgets),
    budgets:
      perCategoryBudget.budgetMode === OnDemandBudgetMode.PER_CATEGORY
        ? perCategoryBudget.budgets
        : {},
  };
}

function getOnDemandBudgets(values: SpendLimitFormValues): OnDemandBudgets {
  return values.budgetMode === OnDemandBudgetMode.PER_CATEGORY
    ? {budgetMode: values.budgetMode, budgets: values.budgets}
    : {budgetMode: values.budgetMode, sharedMaxBudget: values.sharedMaxBudget};
}

function getFormSchema(subscription: Subscription) {
  return z
    .object({
      budgetMode: z.enum(OnDemandBudgetMode),
      budgets: z.custom<Partial<Record<DataCategory, number>>>(
        budgets =>
          !!budgets &&
          typeof budgets === 'object' &&
          Object.values(budgets).every(
            budget => nonNegativeBudgetSchema.safeParse(budget).success
          )
      ),
      sharedMaxBudget: nonNegativeBudgetSchema,
    })
    .superRefine((values, context) => {
      const onDemandBudgets = getOnDemandBudgets(values);
      if (exceedsInvoicedBudgetLimit(subscription, onDemandBudgets)) {
        context.addIssue({
          code: 'custom',
          message: getBudgetExceededInvoicedLimitError(subscription.planDetails),
          path: ['sharedMaxBudget'],
        });
      }
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
    defaultValues: getFormValues(currentOnDemandBudget),
    validators: {onDynamic: getFormSchema(subscription)},
    onSubmit: async ({value}) => {
      const newOnDemandBudget = normalizeOnDemandBudget(getOnDemandBudgets(value));
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

  const handleBudgetUpdate = (onDemandBudgets: OnDemandBudgets) => {
    const values = getFormValues(onDemandBudgets);
    form.setFieldValue('budgetMode', values.budgetMode);
    form.setFieldValue('sharedMaxBudget', values.sharedMaxBudget);
    form.setFieldValue('budgets', values.budgets);
  };

  return (
    <form.AppForm form={form}>
      <Fragment>
        <OffsetBody>
          {renderRequestError(mutation.error, subscription.planDetails)}
          <Container padding="2xl">
            <form.AppField name="budgetMode">
              {modeField => {
                const onDemandBudgets = getOnDemandBudgets({
                  budgetMode: modeField.state.value,
                  sharedMaxBudget: form.getFieldValue('sharedMaxBudget'),
                  budgets: form.getFieldValue('budgets'),
                });
                return (
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
                    onDemandBudgets={onDemandBudgets}
                    currentReserved={currentReserved}
                    addOns={subscription.addOns ?? {}}
                    onUpdate={({onDemandBudgets: nextBudget}) =>
                      handleBudgetUpdate(nextBudget)
                    }
                    usesFormFieldLayout
                    renderBudgetModeSettings={() => (
                      <modeField.Layout.Stack label={t('Spending limit type')}>
                        <modeField.Base<HTMLDivElement>>
                          {(baseProps, {indicator}) => (
                            <Grid columns="1fr auto" gap="sm" align="center">
                              <Container {...baseProps} role="radiogroup" width="100%">
                                <BudgetModeSettings
                                  activePlan={subscription.planDetails}
                                  onDemandBudgets={onDemandBudgets}
                                  onUpdate={({onDemandBudgets: nextBudget}) => {
                                    modeField.handleChange(nextBudget.budgetMode);
                                    handleBudgetUpdate(nextBudget);
                                  }}
                                />
                              </Container>
                              {indicator}
                            </Grid>
                          )}
                        </modeField.Base>
                      </modeField.Layout.Stack>
                    )}
                    renderSpendLimitInput={props => {
                      if (props.category === null) {
                        return (
                          <form.AppField name="sharedMaxBudget">
                            {field => (
                              <Stack gap="lg" paddingTop="xl">
                                <Heading as="h2" size="lg">
                                  {t('Monthly spending limit')}
                                </Heading>
                                <Container width="100%">
                                  <field.Base<HTMLInputElement>>
                                    {(baseProps, {indicator}) => (
                                      <SpendLimitInput
                                        {...props}
                                        currentSpendingLimit={field.state.value}
                                        fieldProps={baseProps}
                                        indicator={indicator}
                                        onUpdate={({newData}) =>
                                          field.handleChange(newData.sharedMaxBudget ?? 0)
                                        }
                                      />
                                    )}
                                  </field.Base>
                                </Container>
                                <field.Meta.HintText>
                                  {t(
                                    'Charges are applied at the end of your usage cycle, and your limit can be adjusted at anytime.'
                                  )}
                                </field.Meta.HintText>
                              </Stack>
                            )}
                          </form.AppField>
                        );
                      }

                      const category = props.category;
                      return (
                        <form.AppField name={`budgets.${category}`}>
                          {field => (
                            <Container width="100%">
                              <field.Base<HTMLInputElement>>
                                {(baseProps, {indicator}) => (
                                  <SpendLimitInput
                                    {...props}
                                    currentSpendingLimit={field.state.value ?? 0}
                                    fieldProps={baseProps}
                                    indicator={indicator}
                                    onUpdate={({newData}) =>
                                      field.handleChange(newData[category] ?? 0)
                                    }
                                  />
                                )}
                              </field.Base>
                            </Container>
                          )}
                        </form.AppField>
                      );
                    }}
                  />
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
