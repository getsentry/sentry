import React, {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {addLoadingMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {TabList, Tabs} from 'sentry/components/tabs';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {DataCategory} from 'sentry/types/core';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

import type {AdminConfirmRenderProps} from 'admin/components/adminConfirmationModal';
import PlanList from 'admin/components/planList';
import {ANNUAL, MONTHLY} from 'getsentry/constants';
import type {BillingConfig, Plan, Subscription} from 'getsentry/types';
import {CheckoutType, PlanTier} from 'getsentry/types';
import {getCategoryInfoFromPlural} from 'getsentry/utils/billing';
import titleCase from 'getsentry/utils/titleCase';

const ALLOWED_TIERS = [PlanTier.MM2, PlanTier.AM1, PlanTier.AM2, PlanTier.AM3];

type Props = AdminConfirmRenderProps & {
  orgId: string;
  partnerPlanId: string | null;
  subscription: Subscription;
};

/**
 * Rendered as part of a openAdminConfirmModal call
 */
function ChangePlanAction({
  subscription,
  orgId,
  partnerPlanId,
  onConfirm,
  setConfirmCallback,
  disableConfirmButton,
}: Props) {
  const [billingInterval, setBillingInterval] = useState<string>(MONTHLY);
  const [contractInterval, setContractInterval] = useState<string>(MONTHLY);
  const [activeTier, setActiveTier] = useState<PlanTier>(PlanTier.AM3);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [reserved, setReserved] = useState<{[key in DataCategory]?: number | null}>({});

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
      configs?.planList.filter(plan =>
        ALLOWED_TIERS.includes(plan.id.split('_')[0] as PlanTier)
      ) ?? [],
    [configs]
  );

  const getPlanList = useCallback((): BillingConfig['planList'] => {
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
  }, [activeTier, billingInterval, contractInterval, partnerPlanId, planList]);

  const canSubmit = useCallback(() => {
    if (!selectedPlanId) {
      return false;
    }

    if (activeTier === PlanTier.MM2) {
      return true;
    }

    const plan = getPlanList().find(p => p.id === selectedPlanId) || null;
    if (!plan) {
      return false;
    }

    return Object.entries(reserved)
      .filter(([category, _]) => plan.checkoutCategories.includes(category))
      .every(([_, value]) => value !== null);
  }, [activeTier, selectedPlanId, reserved, getPlanList]);

  useEffect(() => {
    disableConfirmButton(!canSubmit());
  }, [canSubmit, disableConfirmButton]);

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError />;
  }

  const hasProvisionPermission = () => {
    return ConfigStore.get('user')?.permissions?.has?.('billing.provision');
  };

  // Find the closest volume tier in the plan for a given category and current volume
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

  // Set initial values for reserved volumes based on the current subscription
  // and available tiers in the selected plan
  const setInitialReservedVolumes = (planId: string): void => {
    if (!subscription) {
      return;
    }

    const plan = getPlanList().find(p => p.id === planId) || null;
    if (!plan) {
      return;
    }

    const updates: Record<string, number | null> = {};
    Object.entries(subscription.categories).forEach(([category, metricHistory]) => {
      if (metricHistory.reserved !== undefined) {
        updates[category] = findClosestTier(plan, category, metricHistory.reserved || 0);
      }
    });
    setReserved(updates);
  };

  const handleConfirm = async () => {
    addLoadingMessage('Updating plan\u2026');

    if (activeTier === PlanTier.MM2) {
      const data = {plan: selectedPlanId};
      try {
        await api.requestPromise(`/customers/${orgId}/`, {
          method: 'PUT',
          data,
        });
        addSuccessMessage(
          `Customer account has been updated with ${JSON.stringify(data)}.`
        );
        onConfirm?.(data);
      } catch (error) {
        onConfirm?.({error});
      }
      return;
    }

    // AM plans use a different endpoint to update plans
    const plan = getPlanList().find(p => p.id === selectedPlanId) || null;
    if (!plan) {
      onConfirm?.({error: 'Plan not found'});
      return;
    }

    const data: Record<string, string | number | null> = {
      plan: selectedPlanId,
    };
    plan.checkoutCategories.forEach(category => {
      const reservedVolume = reserved[category as DataCategory] || null;
      data[
        `reserved${titleCase(getCategoryInfoFromPlural(category as DataCategory)?.apiName ?? category)}`
      ] = reservedVolume;
    });

    try {
      await api.requestPromise(`/customers/${orgId}/subscription/`, {
        method: 'PUT',
        data,
      });
      addSuccessMessage(
        `Customer account has been updated with ${JSON.stringify(data)}.`
      );
      onConfirm?.(data);
    } catch (error) {
      onConfirm?.({error});
    }
  };
  setConfirmCallback(handleConfirm);

  const handlePlanChange = (planId: string) => {
    setSelectedPlanId(planId);
    setInitialReservedVolumes(planId);
  };

  const handleLimitChange = (category: DataCategory, value: number) => {
    setReserved(prev => ({...prev, [category]: value}));
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
        planId={selectedPlanId}
        reserved={reserved}
        plans={getPlanList()}
        onPlanChange={handlePlanChange}
        onLimitChange={handleLimitChange}
        currentSubscription={subscription}
      />
    </Fragment>
  );
}

const TabsContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

export default ChangePlanAction;
