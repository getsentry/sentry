import {useMemo, useState} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {openModal, type ModalRenderProps} from 'sentry/actionCreators/modal';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

import {PlanList} from 'admin/components/planList';
import {ANNUAL, BillingConfigTier, MONTHLY} from 'getsentry/constants';
import type {BillingConfig, Plan, Subscription} from 'getsentry/types';

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
  Header,
  Body,
  Footer,
}: Props) {
  const [billingInterval, setBillingInterval] = useState(MONTHLY);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const {
    data: configs,
    isPending,
    isError,
  } = useQuery(
    apiOptions.as<BillingConfig>()('/customers/$organizationIdOrSlug/billing-config/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {tier: BillingConfigTier.ALL},
      staleTime: Infinity,
    })
  );
  const planList = useMemo(() => configs?.planList ?? [], [configs]);

  if (isPending) {
    return <LoadingIndicator />;
  }
  if (isError) {
    return <LoadingError />;
  }

  const tierPlans = planList.filter(
    plan =>
      plan.totalPrice &&
      plan.userSelectable &&
      plan.billingInterval === billingInterval &&
      (partnerPlanId === null || partnerPlanId === plan.id)
  );

  const intervalSelector = partnerPlanId ? null : (
    <Flex gap="sm">
      <Button
        variant={billingInterval === MONTHLY ? 'primary' : 'secondary'}
        onClick={() => setBillingInterval(MONTHLY)}
      >
        Monthly
      </Button>
      <Button
        variant={billingInterval === ANNUAL ? 'primary' : 'secondary'}
        onClick={() => setBillingInterval(ANNUAL)}
      >
        Annual (Upfront)
      </Button>
    </Flex>
  );

  return (
    <PlanList
      Header={Header}
      Body={Body}
      Footer={Footer}
      intervalSelector={intervalSelector}
      activePlan={activePlan}
      subscription={subscription}
      onCancel={closeModal}
      onSuccess={onSuccess}
      onPlanChange={setActivePlan}
      tierPlans={tierPlans}
      organizationSlug={organization.slug}
    />
  );
}

type Options = {
  onSuccess: () => void;
  organization: Organization;
  partnerPlanId: string | null;
  subscription: Subscription;
};

export const triggerChangePlanAction = (opts: Options) =>
  openModal(deps => <ChangePlanAction {...deps} {...opts} />);
