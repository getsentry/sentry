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

export enum SelectableProduct {
  SEER = 'seer', // should match ReservedBudgetCategoryType.SEER
}

type BaseCheckoutData = {
  plan: string;
  applyNow?: boolean;
  onDemandBudget?: OnDemandBudgets;
  onDemandMaxSpend?: number;
  selectedProducts?: Record<SelectableProduct, SelectedProductData>;
};

export type SelectedProductData = {
  enabled: boolean;
  budget?: number; // if not provided, the default budget will be used
};

export type CheckoutFormData = BaseCheckoutData & {
  reserved: Partial<Record<DataCategory, number>>;
};

export type CheckoutAPIData = Omit<BaseCheckoutData, 'selectedProducts'> & {
  paymentIntent?: string;
  previewToken?: string;
  referrer?: string;
  // TODO(data categories): BIL-965
  reservedAttachments?: number;
  reservedErrors?: number;
  reservedLogByte?: number;
  reservedMonitorSeats?: number;
  reservedProfileDuration?: number;
  reservedReplays?: number;
  reservedSpans?: number;
  reservedTransactions?: number;
  reservedUptime?: number;
  seer?: boolean; // TODO: in future, we should just use selectedProducts
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
