import type {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';

import type {Reservations} from 'getsentry/components/upgradeNowModal/types';
import type {
  AddOnCategory,
  BillingConfig,
  CheckoutAddOns,
  OnDemandBudgets,
  Plan,
  Subscription,
} from 'getsentry/types';

type BaseCheckoutData = {
  plan: string;
  addOns?: CheckoutAddOns;
  applyNow?: boolean;
  onDemandBudget?: OnDemandBudgets;
  onDemandMaxSpend?: number;
};

/**
 * Seer auto-reload settings picked in checkout. They aren't part of the
 * subscription, so checkout saves them to the Seer wallet once the plan change
 * goes through.
 */
export type SeerAutoReload = {
  dailyLimitCents: number;
  enabled: boolean;
  reloadAmountCents: number;
};

export type CheckoutFormData = BaseCheckoutData & {
  reserved: Partial<Record<DataCategory, number>>;
  /**
   * Only set for organizations billed for Seer on credits.
   */
  seerAutoReload?: SeerAutoReload;
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
  referrer?: string;
};

export type PlanContent = {
  description: React.ReactNode;
  features: Record<string, React.ReactNode>;
  hasMoreLink?: boolean;
};
