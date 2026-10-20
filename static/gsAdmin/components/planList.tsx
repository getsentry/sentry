import {useMutation} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Container, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {DataCategory} from 'sentry/types/core';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {defined} from 'sentry/utils/defined';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import {ANNUAL} from 'getsentry/constants';
import {
  AddOnCategory,
  type BillingConfig,
  type Plan,
  type Subscription,
} from 'getsentry/types';
import {
  getPlanCategoryName,
  isByteCategory,
  isCheckoutCategory,
} from 'getsentry/utils/dataCategory';
import {formatCurrency} from 'getsentry/utils/formatCurrency';

type FormValue = string | number | boolean | null;
type FormValues = Record<string, FormValue>;

type Props = Pick<ModalRenderProps, 'Header' | 'Body' | 'Footer'> & {
  activePlan: Plan | null;
  intervalSelector: React.ReactNode;
  onCancel: () => void;
  onPlanChange: (plan: Plan) => void;
  onSuccess: () => void;
  organizationSlug: string;
  subscription: Subscription;
  tierPlans: BillingConfig['planList'];
};

function closestTier(
  plan: Plan,
  category: DataCategory,
  currentValue: number
): number | null {
  const tiers = (plan.planCategories as Record<string, Array<{events: number}>>)[
    category
  ];
  if (!tiers?.length) {
    return null;
  }
  const values = tiers.map(tier => tier.events).sort((a, b) => a - b);
  return values.find(value => value >= currentValue) ?? values[values.length - 1] ?? null;
}

export function PlanList({
  Header,
  Body,
  Footer,
  activePlan,
  subscription,
  onCancel,
  onSuccess,
  organizationSlug,
  intervalSelector,
  tierPlans,
  onPlanChange,
}: Props) {
  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      fetchMutation({
        url: getApiUrl('/customers/$organizationIdOrSlug/subscription/', {
          path: {organizationIdOrSlug: organizationSlug},
        }),
        method: 'PUT',
        data,
      }),
    onMutate: () => addLoadingMessage('Updating plan…'),
    onSuccess: () => {
      addSuccessMessage('Customer account has been updated.');
      onCancel();
      onSuccess();
    },
    onError: error => {
      const detail =
        error instanceof RequestError ? error.responseJSON?.detail : undefined;
      addErrorMessage(typeof detail === 'string' ? detail : 'Failed to update plan.');
    },
  });
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {plan: '', 'ticket-url': '', notes: ''} as FormValues,
    onSubmit: ({value}) => {
      if (!value.plan || !tierPlans.some(plan => plan.id === value.plan)) {
        setFieldErrors(form, {plan: {message: 'Choose a plan'}});
        return;
      }
      return mutation.mutateAsync(value).catch(() => {});
    },
  });

  const availableAddOns = Object.values(activePlan?.addOnCategories || {}).filter(
    productInfo => subscription.addOns?.[productInfo.apiName]?.isAvailable ?? false
  );

  const handlePlanChange = (planId: string) => {
    const plan = tierPlans.find(candidate => candidate.id === planId);
    if (!plan) {
      return;
    }
    onPlanChange(plan);
    for (const [category, metricHistory] of Object.entries(subscription.categories)) {
      if (metricHistory.reserved && isCheckoutCategory(category as DataCategory, plan)) {
        const tier = closestTier(plan, category as DataCategory, metricHistory.reserved);
        if (tier !== null) {
          form.setFieldValue(
            `reserved${toTitleCase(category, {allowInnerUpperCase: true})}`,
            tier
          );
        }
      }
    }
    for (const productInfo of Object.values(plan.addOnCategories || {})) {
      const addOnKey = `addOn${toTitleCase(productInfo.apiName, {allowInnerUpperCase: true})}`;
      form.setFieldValue(
        addOnKey,
        subscription.addOns?.[productInfo.apiName]?.enabled ?? false
      );
    }
  };

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h4">Change Plan</Heading>
      </Header>
      <Body>
        <Stack gap="lg">
          {intervalSelector}
          <form.AppField name="plan">
            {field => (
              <field.Layout.Stack label="Plan" required>
                <field.Radio.Group
                  value={String(field.state.value ?? '')}
                  onChange={value => {
                    field.handleChange(value);
                    handlePlanChange(value);
                  }}
                >
                  {tierPlans.map(plan => (
                    <field.Radio.Item key={plan.id} value={plan.id}>
                      <Container data-test-id={`change-plan-label-${plan.id}`}>
                        <Text bold>
                          {plan.name} — {plan.id}
                        </Text>
                        <Text size="sm">
                          {formatCurrency(plan.totalPrice)} /{' '}
                          {plan.billingInterval === ANNUAL ? 'annually' : 'monthly'}
                        </Text>
                      </Container>
                    </field.Radio.Item>
                  ))}
                </field.Radio.Group>
              </field.Layout.Stack>
            )}
          </form.AppField>
          {activePlan &&
            (
              activePlan.planCategories.transactions ||
              activePlan.planCategories.spans ||
              []
            ).length > 1 && (
              <Stack gap="lg">
                <Heading as="h4">Reserved Volumes</Heading>
                {activePlan.categories
                  .filter(category => isCheckoutCategory(category, activePlan))
                  .map(category => {
                    const reservedKey = `reserved${toTitleCase(category, {allowInnerUpperCase: true})}`;
                    const titleCategory = getPlanCategoryName({
                      plan: activePlan,
                      category,
                    });
                    const label = isByteCategory(category)
                      ? `${titleCategory} (GB)`
                      : titleCategory;
                    const reservedValue = subscription.categories?.[category]?.reserved;
                    const options = (activePlan.planCategories[category] || []).map(
                      (level: {events: number}) => ({
                        label: level.events.toLocaleString(),
                        value: level.events,
                      })
                    );
                    return (
                      <form.AppField key={category} name={reservedKey}>
                        {field => (
                          <field.Layout.Stack label={label} required>
                            <field.Select
                              value={
                                typeof field.state.value === 'number'
                                  ? field.state.value
                                  : null
                              }
                              onChange={field.handleChange}
                              options={options}
                            />
                            <Text size="sm" variant="muted">
                              Current:{' '}
                              {defined(reservedValue)
                                ? reservedValue.toLocaleString()
                                : 'None'}{' '}
                              {isByteCategory(category) && defined(reservedValue)
                                ? 'GB'
                                : ''}
                            </Text>
                          </field.Layout.Stack>
                        )}
                      </form.AppField>
                    );
                  })}
              </Stack>
            )}
          {availableAddOns.length > 0 && (
            <Stack gap="lg">
              <Heading as="h4">Available Products</Heading>
              {availableAddOns.map(productInfo => {
                const addOnKey = `addOn${toTitleCase(productInfo.apiName, {allowInnerUpperCase: true})}`;
                const titleCaseName = toTitleCase(productInfo.productName, {
                  allowInnerUpperCase: true,
                });
                const label =
                  productInfo.apiName === AddOnCategory.LEGACY_SEER
                    ? `${titleCaseName} (Legacy)`
                    : titleCaseName;
                return (
                  <form.AppField key={productInfo.apiName} name={addOnKey}>
                    {field => (
                      <field.Checkbox
                        data-test-id={`checkbox-${productInfo.productName}`}
                        label={label}
                        checked={Boolean(field.state.value)}
                        onChange={field.handleChange}
                      />
                    )}
                  </form.AppField>
                );
              })}
            </Stack>
          )}
          <form.AppField name="ticket-url">
            {field => (
              <field.Layout.Stack label="TicketUrl">
                <field.Input
                  type="url"
                  data-test-id="url-field"
                  value={String(field.state.value ?? '')}
                  onChange={field.handleChange}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="notes">
            {field => (
              <field.Layout.Stack label="Notes">
                <field.Input
                  data-test-id="notes-field"
                  value={String(field.state.value ?? '')}
                  onChange={field.handleChange}
                  maxLength={500}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
        </Stack>
      </Body>
      <Footer>
        <Button onClick={onCancel}>Cancel</Button>
        <form.SubmitButton variant="danger">Change Plan</form.SubmitButton>
      </Footer>
    </form.AppForm>
  );
}
