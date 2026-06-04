import type {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';

import type {Reservations} from 'getsentry/components/upgradeNowModal/types';
import type {
  AddOnCategory,
  BillingConfig,
  CheckoutAddOns,
  OnDemandBudgets,
  Plan,
  PlanTier,
  Subscription,
} from 'getsentry/types';

type BaseCheckoutData = {
  plan: string;
  addOns?: CheckoutAddOns;
  applyNow?: boolean;
  onDemandBudget?: OnDemandBudgets;
  onDemandMaxSpend?: number;
};

export type CheckoutFormData = BaseCheckoutData & {
  reserved: Partial<Record<DataCategory, number>>;
};

export type CheckoutAPIData = Omit<BaseCheckoutData, 'addOns'> & {
  paymentIntent?: string;
  previewToken?: string;
  referrer?: string;
} & Partial<Reservations> &
  Partial<Record<`addOn${Capitalize<AddOnCategory>}`, boolean>>;

export type StepProps = {
  activePlan: Plan;
  billingConfig: BillingConfig;
  formData: CheckoutFormData;
  onUpdate: (data: any) => void;
  organization: Organization;
  stepNumber: number;
  subscription: Subscription;
  checkoutTier?: PlanTier;
  referrer?: string;
};

export type PlanContent = {
  description: React.ReactNode;
  features: Record<string, React.ReactNode>;
  hasMoreLink?: boolean;
};
