import type {Client} from 'sentry/api';
import type {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';

import type {
  BillingConfig,
  OnDemandBudgets,
  Plan,
  PlanTier,
  Promotion,
  Subscription,
} from 'getsentry/types';

type BaseCheckoutData = {
  plan: string;
  applyNow?: boolean;
  onDemandBudget?: OnDemandBudgets;
  onDemandMaxSpend?: number;
};

export type CheckoutFormData = BaseCheckoutData & {
  reserved: {
    [categoryKey in DataCategory]?: number;
  };
};

export type CheckoutAPIData = BaseCheckoutData & {
  paymentIntent?: string;
  previewToken?: string;
  referrer?: string;
  reservedAttachments?: number;
  reservedErrors?: number;
  reservedMonitorSeats?: number;
  reservedProfileDuration?: number;
  reservedReplays?: number;
  reservedSpans?: number;
  reservedTransactions?: number;
  reservedUptime?: number;
};

export type StepProps = {
  activePlan: Plan;
  billingConfig: BillingConfig;
  formData: CheckoutFormData;
  isActive: boolean;
  isCompleted: boolean;
  onCompleteStep: (stepNumber: number) => void;
  onEdit: (stepNumber: number) => void;
  onUpdate: (data: any) => void;
  organization: Organization;
  prevStepCompleted: boolean;
  stepNumber: number;
  subscription: Subscription;
  checkoutTier?: PlanTier;
  onToggleLegacy?: (tier: string) => void;
  promotion?: Promotion;
  referrer?: string;
};

export interface StepPropsWithApi extends StepProps {
  api: Client;
}
