import {useState} from 'react';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
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
import {getPlanCategoryName} from 'getsentry/utils/dataCategory';
import {SpendLimitSettings} from 'getsentry/views/spendLimits/spendLimitSettings';

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

const spendLimitFormSchema = z.object({
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
});

function getRequestErrorMessage(error: Error, plan: Plan) {
  if (error instanceof RequestError && error.responseJSON) {
    const message = Object.entries(error.responseJSON)
      .map(
        ([field, messages]) =>
          `${field}: ${Array.isArray(messages) ? messages.join(' ') : String(messages)}`
      )
      .join(' ');
    if (message) {
      return message;
    }
  }

  return getBudgetSaveError(plan);
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
    onError: error => {
      addErrorMessage(getRequestErrorMessage(error, subscription.planDetails));
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: getFormValues(currentOnDemandBudget),
    validators: {onDynamic: spendLimitFormSchema},
    onSubmit: async ({value}) => {
      const newOnDemandBudget = normalizeOnDemandBudget(getOnDemandBudgets(value));
      if (exceedsInvoicedBudgetLimit(subscription, newOnDemandBudget)) {
        addErrorMessage(getBudgetExceededInvoicedLimitError(subscription.planDetails));
        return;
      }
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
      <form.Subscribe selector={state => state.values}>
        {values => (
          <form.AppField name="budgetMode">
            {modeField => {
              const onDemandBudgets = getOnDemandBudgets({
                ...values,
                budgetMode: modeField.state.value,
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
                  renderBudgetModeSettings={() =>
                    subscription.planDetails.hasOnDemandModes ? (
                      <modeField.Layout.Stack label={t('Spending limit type')}>
                        <modeField.Radio.Group
                          value={modeField.state.value}
                          onChange={budgetMode =>
                            handleBudgetUpdate(
                              convertOnDemandBudget(
                                onDemandBudgets,
                                budgetMode as OnDemandBudgetMode
                              )
                            )
                          }
                        >
                          {/* TODO: Replace with a card-style RadioField primitive when available. */}
                          <Grid
                            columns={{zero: '1fr', lg: 'repeat(2, minmax(0, 1fr))'}}
                            gap="lg"
                          >
                            <modeField.Radio.Item value={OnDemandBudgetMode.PER_CATEGORY}>
                              {t('Set a spending limit for each product')}
                            </modeField.Radio.Item>
                            <modeField.Radio.Item value={OnDemandBudgetMode.SHARED}>
                              {t('Set a spending limit shared across all products')}
                            </modeField.Radio.Item>
                          </Grid>
                        </modeField.Radio.Group>
                      </modeField.Layout.Stack>
                    ) : null
                  }
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
                                <field.Number
                                  aria-label={t(
                                    'Custom shared spending limit (in dollars)'
                                  )}
                                  leadingItems="$"
                                  min={0}
                                  step={1}
                                  placeholder="300"
                                  value={field.state.value / 100}
                                  onChange={value =>
                                    field.handleChange(
                                      Math.max(Math.trunc(value ?? 0), 0) * 100
                                    )
                                  }
                                />
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
                    const displayName = getPlanCategoryName({
                      plan: subscription.planDetails,
                      category,
                      capitalize: false,
                    });
                    return (
                      <form.AppField name={`budgets.${category}`}>
                        {field => (
                          <Container width="100%">
                            <field.Number
                              aria-label={t(
                                'Custom %s spending limit (in dollars)',
                                displayName
                              )}
                              leadingItems="$"
                              min={0}
                              step={1}
                              placeholder="300"
                              value={(field.state.value ?? 0) / 100}
                              onChange={value =>
                                field.handleChange(
                                  Math.max(Math.trunc(value ?? 0), 0) * 100
                                )
                              }
                            />
                          </Container>
                        )}
                      </form.AppField>
                    );
                  }}
                />
              );
            }}
          </form.AppField>
        )}
      </form.Subscribe>
      <Footer>
        <Flex justify="end" gap="md">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <form.SubmitButton>{t('Save')}</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}

export default SpendLimitsEditModal;
