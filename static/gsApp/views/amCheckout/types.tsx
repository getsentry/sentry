import type {Client} from 'sentry/api';
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
  Promotion,
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

type BaseStepProps = {
  activePlan: Plan;
  billingConfig: BillingConfig;
  formData: CheckoutFormData;
  onEdit: (stepNumber: number) => void;
  onUpdate: (data: any) => void;
  organization: Organization;
  stepNumber: number;
  subscription: Subscription;
  checkoutTier?: PlanTier;
  referrer?: string;
};

export type StepProps = BaseStepProps & {
  isActive: boolean;
  isCompleted: boolean;
  onCompleteStep: (stepNumber: number) => void;
  prevStepCompleted: boolean;
  isNewCheckout?: boolean;
  onToggleLegacy?: (tier: string) => void;
  promotion?: Promotion;
};

export interface StepPropsWithApi extends StepProps {
  api: Client;
}

export type CheckoutV3StepProps = BaseStepProps;

export type PlanContent = {
  description: React.ReactNode;
  features: Record<string, React.ReactNode>;
  hasMoreLink?: boolean;
};
