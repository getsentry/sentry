import React, {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {openModal, type ModalRenderProps} from 'sentry/actionCreators/modal';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import FormModel from 'sentry/components/forms/model';
import type {Data, OnSubmitCallback} from 'sentry/components/forms/types';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import useApi from 'sentry/utils/useApi';

import PlanList from 'admin/components/planList';
import {ANNUAL, MONTHLY} from 'getsentry/constants';
import type {BillingConfig, Plan, Subscription} from 'getsentry/types';
import {CheckoutType, PlanTier} from 'getsentry/types';

const ALLOWED_TIERS = [PlanTier.MM2, PlanTier.AM1, PlanTier.AM2, PlanTier.AM3];

type Props = {
  onSuccess: () => void;
  organization: Organization;
  partnerPlanId: string | null;
  subscription: Subscription;
} & ModalRenderProps;

function ChangePlanAction({
  subscription,
  organization,
  partnerPlanId,
  onSuccess,
  closeModal,
}: Props) {
  const [billingInterval, setBillingInterval] = useState<string>(MONTHLY);
  const [contractInterval, setContractInterval] = useState<string>(MONTHLY);
  const [activeTier, setActiveTier] = useState<PlanTier>(PlanTier.AM3);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [formModel] = useState(() => new FormModel());
  const orgId = organization.slug;

  const api = useApi({persistInFlight: true});
  const {
    data: configs,
    isPending,
    isError,
  } = useApiQuery<BillingConfig>([`/customers/${orgId}/billing-config/?tier=all`], {
    // TODO(isabella): pass billing config from customerDetails
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
          plan.price !== 0 && // filter out enterprise, trial, and free test plans
          plan.billingInterval === billingInterval &&
          plan.contractInterval === contractInterval
      );
    }
    return planList
      .sort((a, b) => a.reservedMinimum - b.reservedMinimum)
      .filter(
        plan =>
          plan.price &&
          (plan.userSelectable || plan.checkoutType === CheckoutType.BUNDLE) &&
          plan.billingInterval === billingInterval &&
          plan.contractInterval === contractInterval &&
          // Plan id on partner sponsored subscriptions is not modifiable so only including
          // the existing plan in the list
          ((partnerPlanId === null && plan.id.split('_')[0] === activeTier) ||
            partnerPlanId === plan.id)
      );
  };

  /**
   * Find the closest volume tier in the plan for a given category and current volume
   */
  const findClosestTier = (
    plan: Plan | null,
    category: DataCategory,
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
      if (
        metricHistory.reserved &&
        plan.checkoutCategories.includes(category as DataCategory)
      ) {
        const closestTier = findClosestTier(
          plan,
          category as DataCategory,
          metricHistory.reserved
        );
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

    if (!data.plan || !planList.some(p => p.id === data.plan)) {
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

  return (
    <Fragment>
      {header}
      <PlanList
        formModel={formModel}
        activePlan={activePlan}
        subscription={subscription}
        onSubmit={handleSubmit}
        onCancel={closeModal}
        onSubmitSuccess={(data: Data) => {
          addSuccessMessage(
            `Customer account has been updated with ${JSON.stringify(data)}.`
          );
          closeModal();
          onSuccess();
        }}
        onSubmitError={(error: any) => {
          addErrorMessage(error?.responseJSON?.detail ?? error);
        }}
        onPlanChange={handlePlanChange}
        tierPlans={getPlanListForTier()}
      />
    </Fragment>
  );
}

type Options = {
  onSuccess: () => void;
  organization: Organization;
  partnerPlanId: string | null;
  subscription: Subscription;
};

const triggerChangePlanAction = (opts: Options) =>
  openModal(deps => <ChangePlanAction {...deps} {...opts} />);

const TabsContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

export default triggerChangePlanAction;
