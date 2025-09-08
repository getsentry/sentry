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
  seer?: boolean; // TODO: in future, we should just use selectedProducts
} & Partial<Record<`reserved${Capitalize<DataCategory>}`, number>>;

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
