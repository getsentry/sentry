import React, {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {type ModalRenderProps, openModal} from 'sentry/actionCreators/modal';
import InputField from 'sentry/components/forms/fields/inputField';
import RadioField from 'sentry/components/forms/fields/radioField';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import type {Data, OnSubmitCallback} from 'sentry/components/forms/types';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {TabList, Tabs} from 'sentry/components/tabs';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import {useApiQuery} from 'sentry/utils/queryClient';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import useApi from 'sentry/utils/useApi';

import {ANNUAL, MONTHLY} from 'getsentry/constants';
import type {BillingConfig, DataCategories, Plan, Subscription} from 'getsentry/types';
import {CheckoutType, PlanTier} from 'getsentry/types';
import {getPlanCategoryName} from 'getsentry/utils/dataCategory';
import formatCurrency from 'getsentry/utils/formatCurrency';

const ALLOWED_TIERS = [PlanTier.MM2, PlanTier.AM1, PlanTier.AM2, PlanTier.AM3];

type Props = {
  onSuccess: () => void;
  orgId: string;
  partnerPlanId: string | null;
  subscription: Subscription;
} & ModalRenderProps;

function ChangePlanAction({
  subscription,
  orgId,
  partnerPlanId,
  onSuccess,
  closeModal,
}: Props) {
  const [billingInterval, setBillingInterval] = useState<string>(MONTHLY);
  const [contractInterval, setContractInterval] = useState<string>(MONTHLY);
  const [activeTier, setActiveTier] = useState<PlanTier>(PlanTier.AM3);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [formModel] = useState(() => new FormModel());

  const api = useApi({persistInFlight: true});
  const {
    data: configs,
    isPending,
    isError,
  } = useApiQuery<BillingConfig>([`/customers/${orgId}/billing-config/?tier=all`], {
    staleTime: Infinity,
  });

  const planList = useMemo(
    () =>
      configs?.planList.filter(
        plan =>
          ALLOWED_TIERS.includes(plan.id.split('_')[0] as PlanTier) || plan.isTestPlan
      ) ?? [],
    [configs]
  );

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError />;
  }

  /**
   * Check if the user has provision permission for test plans
   */
  const hasProvisionPermission = () => {
    return ConfigStore.get('user')?.permissions?.has?.('billing.provision');
  };

  /**
   * Get the plan list for the active tier
   */
  const getPlanListForTier = (): BillingConfig['planList'] => {
    if (activeTier === PlanTier.TEST) {
      return planList.filter(
        plan =>
          plan.isTestPlan &&
          plan.billingInterval === billingInterval &&
          plan.contractInterval === contractInterval
      );
    }
    return planList.filter(
      plan =>
        plan.price &&
        (plan.userSelectable || plan.checkoutType === CheckoutType.BUNDLE) &&
        plan.id.split('_')[0] === activeTier &&
        plan.billingInterval === billingInterval &&
        plan.contractInterval === contractInterval &&
        // Plan id on partner sponsored subscriptions is not modifiable so only including
        // the existing plan in the list
        (partnerPlanId === null || partnerPlanId === plan.id)
    );
  };

  /**
   * Find the closest volume tier in the plan for a given category and current volume
   */
  const findClosestTier = (
    plan: Plan | null,
    category: string,
    currentValue: number
  ): number | null => {
    if (!plan?.planCategories || !(category in plan.planCategories)) {
      return null;
    }

    const categoryBuckets = (plan.planCategories as Record<string, any>)[category];
    if (!categoryBuckets?.length) {
      return null;
    }

    const availableTiers = categoryBuckets.map((tier: {events: number}) => tier.events);

    // If the exact value exists, use it
    if (availableTiers.includes(currentValue)) {
      return currentValue;
    }

    // Find the closest tier, preferring the next higher tier if not exact
    const sortedTiers = [...availableTiers].sort((a, b) => a - b);

    // Find the first tier that's greater than the current value
    const nextHigherTier = sortedTiers.find(tier => tier > currentValue);
    if (nextHigherTier) {
      return nextHigherTier;
    }

    // If no higher tier, take the highest available
    return sortedTiers[sortedTiers.length - 1];
  };

  /**
   * Set initial values for reserved volumes based on the current subscription
   * and available tiers in the newly selected plan
   */
  const setInitialReservedVolumes = (planId: string): void => {
    const plan = getPlanListForTier().find(p => p.id === planId) || null;
    if (!plan) {
      return;
    }

    Object.entries(subscription.categories).forEach(([category, metricHistory]) => {
      if (metricHistory.reserved) {
        const closestTier = findClosestTier(plan, category, metricHistory.reserved);
        if (closestTier) {
          formModel.setValue(
            `reserved${toTitleCase(category, {
              allowInnerUpperCase: true,
            })}`,
            closestTier
          );
        }
      }
    });
  };

  const handlePlanChange = (plan: Plan) => {
    setActivePlan(plan);
    setInitialReservedVolumes(plan.id);
  };

  const handleSubmit: OnSubmitCallback = async (
    data: Data,
    onSubmitSuccess: (data: Data) => void,
    onSubmitError: (error: any) => void
  ) => {
    addLoadingMessage('Updating plan\u2026');

    if (!data.plan || !planList.find(p => p.id === data.plan)) {
      onSubmitError('Plan not found');
      return;
    }

    if (activeTier === PlanTier.MM2) {
      try {
        await api.requestPromise(`/customers/${orgId}/`, {
          method: 'PUT',
          data,
        });
        onSubmitSuccess(data);
      } catch (error) {
        onSubmitError(error);
      }
      return;
    }

    // AM plans use a different endpoint to update plans
    try {
      await api.requestPromise(`/customers/${orgId}/subscription/`, {
        method: 'PUT',
        data,
      });
      onSubmitSuccess(data);
      onSuccess?.();
    } catch (error) {
      onSubmitError(error);
    }
  };

  // Plan for partner sponsored subscriptions is not modifiable so skipping
  // the navigation that will allow modifying billing cycle and plan tier
  const PLAN_TABS = [
    {
      label: 'AM3',
      tier: PlanTier.AM3,
    },
    {
      label: 'AM2',
      tier: PlanTier.AM2,
    },
    {
      label: 'AM1',
      tier: PlanTier.AM1,
    },
    {
      label: 'MM2',
      tier: PlanTier.MM2,
    },
    {
      label: 'TEST',
      tier: PlanTier.TEST,
    },
  ];

  const header = partnerPlanId ? null : (
    <React.Fragment>
      <TabsContainer>
        <Tabs
          value={activeTier}
          onChange={tab => {
            setActivePlan(null);
            setActiveTier(tab);
            setBillingInterval(MONTHLY);
            setContractInterval(MONTHLY);
          }}
        >
          <TabList>
            {PLAN_TABS.filter(
              tab => tab.tier !== PlanTier.TEST || hasProvisionPermission()
            ).map(tab => (
              <TabList.Item key={tab.tier}>{tab.label}</TabList.Item>
            ))}
          </TabList>
        </Tabs>
      </TabsContainer>
      <ul className="nav nav-pills">
        <li
          className={classNames({
            active: contractInterval === MONTHLY && billingInterval === MONTHLY,
          })}
        >
          <a
            onClick={() => {
              setBillingInterval(MONTHLY);
              setContractInterval(MONTHLY);
            }}
          >
            Monthly
          </a>
        </li>
        {activeTier === PlanTier.MM2 && (
          <li
            className={classNames({
              active: contractInterval === ANNUAL && billingInterval === MONTHLY,
            })}
          >
            <a
              onClick={() => {
                setBillingInterval(MONTHLY);
                setContractInterval(ANNUAL);
              }}
            >
              Annual (Contract)
            </a>
          </li>
        )}
        <li
          className={classNames({
            active: contractInterval === ANNUAL && billingInterval === ANNUAL,
          })}
        >
          <a
            onClick={() => {
              setBillingInterval(ANNUAL);
              setContractInterval(ANNUAL);
            }}
          >
            Annual (Upfront)
          </a>
        </li>
      </ul>
    </React.Fragment>
  );

  /**
   * Helper to get current value display for a category
   */
  const getCurrentValueDisplay = (category: DataCategory) => {
    // Check if categories exist
    if (subscription.categories) {
      // Get the category data using type assertion to allow string indexing
      const categories = subscription.categories as Record<string, {reserved?: number}>;

      if (categories[category] && categories[category].reserved !== undefined) {
        const reservedValue = categories[category].reserved;

        return (
          <CurrentValueText>
            Current: {reservedValue.toLocaleString()}{' '}
            {category === DataCategory.ATTACHMENTS ? 'GB' : ''}
          </CurrentValueText>
        );
      }
    }

    return <CurrentValueText>Current: None</CurrentValueText>;
  };

  // for legacy errors-only plans
  const formattedReservedMinimum = {
    6000000: '6M',
    5000000: '5M',
    4000000: '4M',
    3000000: '3M',
    1500000: '1.5M',
    500000: '500k',
    100000: '100K',
  };

  return (
    <Fragment>
      {header}
      <Form
        onSubmit={handleSubmit}
        onCancel={closeModal}
        submitLabel="Change Plan"
        submitPriority="danger"
        model={formModel}
        onSubmitSuccess={(data: Data) => {
          addSuccessMessage(
            `Customer account has been updated with ${JSON.stringify(data)}.`
          );
          closeModal();
          onSuccess();
        }}
        onSubmitError={error => addErrorMessage(error?.responseJSON?.detail ?? error)}
      >
        <StyledFormSection>
          <RadioField
            name="plan"
            required
            choices={getPlanListForTier().map(plan => [
              plan.id,
              <PlanLabel key={plan.id} data-test-id={`change-plan-label-${plan.id}`}>
                <div>
                  <strong>
                    {plan.name}{' '}
                    {formattedReservedMinimum[
                      plan.reservedMinimum as keyof typeof formattedReservedMinimum
                    ] ?? ''}
                  </strong>{' '}
                  <SubText>— {plan.id}</SubText>
                  <br />
                  <small>
                    {formatCurrency(plan.price)} /{' '}
                    {plan.billingInterval === ANNUAL ? 'annually' : 'monthly'}
                  </small>
                </div>
              </PlanLabel>,
            ])}
            onChange={value => {
              const plan = getPlanListForTier().find(p => p.id === value);
              if (plan) {
                handlePlanChange(plan);
              }
            }}
            value={activePlan?.id ?? null}
          />
        </StyledFormSection>
        {activePlan &&
          (
            activePlan?.planCategories.transactions ||
            activePlan?.planCategories.spans ||
            []
          ).length > 1 && (
            <StyledFormSection>
              <h4>Reserved Volumes</h4>
              {activePlan.checkoutCategories.map(category => {
                const titleCategory = getPlanCategoryName({plan: activePlan, category});
                const reservedKey = `reserved${toTitleCase(category, {
                  allowInnerUpperCase: true,
                })}`;
                const label =
                  category === DataCategory.ATTACHMENTS
                    ? `${titleCategory} (GB)`
                    : titleCategory;
                const currentReserved =
                  subscription.categories[category as DataCategories]?.reserved ?? null;
                const fieldValue =
                  currentReserved === null
                    ? null
                    : (findClosestTier(activePlan, category, currentReserved) ?? null);
                const currentValueDisplay = getCurrentValueDisplay(
                  category as DataCategory
                );
                return (
                  <SelectFieldWrapper key={`test-${category}`}>
                    <SelectField
                      inline={false}
                      stacked
                      name={reservedKey}
                      label={label}
                      value={fieldValue}
                      options={(
                        activePlan.planCategories[category as DataCategories] || []
                      ).map((level: {events: {toLocaleString: () => any}}) => ({
                        label: level.events.toLocaleString(),
                        value: level.events,
                      }))}
                      required
                    />
                    {currentValueDisplay}
                  </SelectFieldWrapper>
                );
              })}
            </StyledFormSection>
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
          />
          <TextField
            data-test-id="notes-field"
            name="notes"
            label="Notes"
            inline={false}
            stacked
            flexibleControlStateSize
            maxLength={500}
          />
        </AuditFields>
      </Form>
    </Fragment>
  );
}

const TabsContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

const StyledFormSection = styled('div')`
  margin: ${space(1)} 0;

  & > h4 {
    margin: ${space(2)} 0;
  }
`;

const PlanLabel = styled('label')`
  margin-bottom: 0;

  display: flex;
  align-items: flex-start;

  & > div {
    margin-right: ${space(3)};
  }
`;

const SubText = styled('small')`
  font-weight: normal;
  color: #999;
`;

const SelectFieldWrapper = styled('div')`
  position: relative;
`;

const CurrentValueText = styled('div')`
  color: #666;
  font-size: 0.9em;
  margin-top: -${space(1)};
  margin-bottom: ${space(1.5)};
  font-style: italic;
`;

const AuditFields = styled('div')`
  margin-top: ${space(2)};
`;

type Options = {
  onSuccess: () => void;
  orgId: string;
  partnerPlanId: string | null;
  subscription: Subscription;
};

const triggerChangePlanAction = (opts: Options) =>
  openModal(deps => <ChangePlanAction {...deps} {...opts} />);

export default triggerChangePlanAction;
