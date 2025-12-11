import type {StripeConstructor} from '@stripe/stripe-js';

import type {DATA_CATEGORY_INFO} from 'sentry/constants';
import type {DataCategory, DataCategoryInfo} from 'sentry/types/core';
import type {User} from 'sentry/types/user';

declare global {
  interface Window {
    /**
     * Used in admin
     */
    __sendGridApiKey: string;
    /**
     * Google analytics
     */
    ga: any;
    /**
     * Reload agent
     */
    ra: any;
    /**
     * Bing
     */
    uetq: any;
    /**
     * Zendesk widget
     */
    zE: any;
    /**
     * Stripe SDK
     */
    Stripe?: StripeConstructor;
    /**
     * Pendo which is used to render guides
     */
    pendo?: any; // TODO: use types package
  }

  namespace React {
    interface DOMAttributes<T> {
      'data-test-id'?: string;
    }
  }
}

/**
 * Allows for declaration merging, so getsentry can add additional properties
 * to Sentry interfaces.
 */
declare module 'sentry/types/system' {
  interface Config {
    'getsentry.amplitudeApiKey'?: string;
    'getsentry.googleMapsApiKey'?: string;
    'getsentry.sendgridApiKey'?: string;
    'getsentry.stripePublishKey'?: string;
  }
}

export type EventBucket = {
  events: number;
  price: number;
  onDemandPrice?: number;
  /**
   * Available in performance plans
   */
  unitPrice?: number;
};

export enum PlanName {
  DEVELOPER = 'Developer',
  TEAM = 'Team',
  BUSINESS = 'Business',
  TEAM_BUNDLE = 'Team Bundle',
  BUSINESS_BUNDLE = 'Business Bundle',
  TEAM_SPONSORED = 'Sponsored Team',
  BUSINESS_SPONSORED = 'Sponsored Business',
  ENTERPRISE_TEAM = 'Enterprise (Team)',
  ENTERPRISE_BUSINESS = 'Enterprise (Business)',
}

export enum CheckoutType {
  STANDARD = 'standard',
  BUNDLE = 'bundle',
}

export enum ReservedBudgetCategoryType {
  DYNAMIC_SAMPLING = 'dynamicSampling',
  SEER = 'seer',
}

export type ReservedBudgetCategory = {
  /**
   * The API name of the budget
   */
  apiName: ReservedBudgetCategoryType;
  /**
   * The feature flag determining if the product is available for billing
   */
  billingFlag: string | null;
  /**
   * Backend name of the category (all caps, snake case)
   */
  budgetCategoryType: string;
  /**
   * whether a customer can use product trials for this budget
   */
  canProductTrial: boolean;
  /**
   * the categories that are included in the budget
   */
  dataCategories: DataCategory[];
  /**
   * Default budget for the category, in cents
   */
  defaultBudget: number | null;
  /**
   * Link to the quotas documentation for the budget
   */
  docLink: string;
  /**
   * Whether the budget is fixed or variable
   */
  isFixed: boolean;
  /**
   * Display name of the budget
   */
  name: string;
  /**
   * The name of the product to display in the checkout flow
   */
  productCheckoutName: string;
  /**
   * The name of the product associated with the budget
   */
  productName: string;
};

export enum AddOnCategory {
  SEER = 'seer',
  LEGACY_SEER = 'legacySeer',
}

export type AddOnCategoryInfo = {
  apiName: AddOnCategory;
  billingFlag: string | null;
  dataCategories: DataCategory[];
  name: string;
  order: number;
  productName: string;
};

export type AddOn = AddOnCategoryInfo & {
  /**
   * Whether the subscription has bought the add-on
   */
  enabled: boolean;
  /**
   * Whether the subscription can buy the add-on
   */
  isAvailable: boolean;
};

type AddOns = Partial<Record<AddOnCategory, AddOn>>;

// how addons are represented in the checkout form data
export type CheckoutAddOns = Partial<Record<AddOnCategory, Pick<AddOn, 'enabled'>>>;

type RetentionSettings = {
  downsampled: number | null;
  standard: number | null;
};

export type Plan = {
  addOnCategories: Partial<Record<AddOnCategory, AddOnCategoryInfo>>;
  allowAdditionalReservedEvents: boolean;
  allowOnDemand: boolean;
  /**
   * All available data categories on the current plan tier.
   * Can be used for category upsells.
   */
  availableCategories: DataCategory[];
  availableReservedBudgetTypes: Partial<
    Record<ReservedBudgetCategoryType, ReservedBudgetCategory>
  >;
  basePrice: number;
  billingInterval: 'monthly' | 'annual';
  budgetTerm: 'pay-as-you-go' | 'on-demand';
  /**
   * Data categories on the plan (errors, transactions, etc.)
   */
  categories: DataCategory[];
  checkoutCategories: DataCategory[];
  contractInterval: 'monthly' | 'annual';
  dashboardLimit: number;
  description: string;
  features: string[];

  hasOnDemandModes: boolean;
  id: string;
  isTestPlan: boolean;
  maxMembers: number | null;
  metricDetectorLimit: number;
  name: string;
  onDemandCategories: DataCategory[];
  onDemandEventPrice: number;
  planCategories: Partial<Record<DataCategory, EventBucket[]>>;
  price: number;

  reservedMinimum: number;
  retentionDays: number;
  totalPrice: number;
  trialPlan: string | null;
  userSelectable: boolean;
  categoryDisplayNames?: Partial<
    Record<DataCategory, {plural: string; singular: string}>
  >;
  checkoutType?: CheckoutType;
  retentions?: Partial<Record<DataCategory, RetentionSettings>>;
};

type PendingChanges = {
  customPrice: number | null;
  customPricePcss: number | null;
  customPrices: Partial<Record<DataCategory, number | null>>;
  effectiveDate: string;
  onDemandBudgets: PendingOnDemandBudgets | null;
  onDemandEffectiveDate: string;
  onDemandMaxSpend: number;
  plan: string;
  planDetails: Plan;
  planName: string;
  reserved: Partial<Record<DataCategory, number | null>>;
  reservedBudgets: PendingReservedBudget[];
  reservedCpe: Partial<Record<DataCategory, number | null>>;
};

enum VatStatus {
  UNKNOWN = 'unknown',
  PERSONAL = 'personal',
  BUSINESS = 'business',
  BUSINESS_NOVAT = 'business_novat',
  OTHER = 'other',
}

export type GDPRDetails = {
  dpoAddress: string;
  dpoEmail: string;
  dpoName: string;
  dpoPhone: string;
  euRepAddress: string;
  euRepEmail: string;
  euRepName: string;
  euRepPhone: string;
};

type Partner = {
  externalId: string;
  isActive: boolean;
  name: string;
  partnership: {
    displayName: string;
    id: string;
    supportNote: string;
  };
};

export enum BillingType {
  CREDIT_CARD = 'credit card',
  INVOICED = 'invoiced',
  PARTNER = 'partner',
}

export enum OnDemandBudgetMode {
  SHARED = 'shared',
  PER_CATEGORY = 'per_category',
}

export type SharedOnDemandBudget = {
  budgetMode: OnDemandBudgetMode.SHARED;
  sharedMaxBudget: number;
};

type SharedOnDemandBudgetWithSpends = SharedOnDemandBudget & {
  onDemandSpendUsed: number;
};

export type PerCategoryOnDemandBudget = {
  budgetMode: OnDemandBudgetMode.PER_CATEGORY;
  budgets: Partial<Record<DataCategory, number>>;
};

type PerCategoryOnDemandBudgetWithSpends = PerCategoryOnDemandBudget & {
  usedSpends: Partial<Record<DataCategory, number>>;
};

export type OnDemandBudgets = SharedOnDemandBudget | PerCategoryOnDemandBudget;

type OnDemandBudgetsEnabled = {
  enabled: boolean;
};

type OnDemandBudgetsWithSpends =
  | SharedOnDemandBudgetWithSpends
  | PerCategoryOnDemandBudgetWithSpends;

export type SubscriptionOnDemandBudgets = OnDemandBudgetsEnabled &
  OnDemandBudgetsWithSpends;

export type PendingOnDemandBudgets = OnDemandBudgetsEnabled & OnDemandBudgets;

export type ProductTrial = {
  category: DataCategory;
  isStarted: boolean;
  reasonCode: number;
  betaOptInStatus?: boolean;
  endDate?: string;
  lengthDays?: number;
  startDate?: string;
};

export type Subscription = {
  accountBalance: number;
  billingInterval: 'monthly' | 'annual';
  // billingPeriod varies between 1-12 months. if you're looking for the monthly usage interval, use onDemandPeriodStart
  billingPeriodEnd: string;

  billingPeriodStart: string;
  canCancel: boolean;
  canGracePeriod: boolean;
  canSelfServe: boolean;
  canTrial: boolean;

  cancelAtPeriodEnd: boolean;
  /**
   * Current history per data category
   */
  categories: Partial<Record<DataCategory, BillingMetricHistory>>;
  contractInterval: 'monthly' | 'annual';

  contractPeriodEnd: string;
  contractPeriodStart: string;
  customPrice: number | null;
  customPricePcss: number | null;
  dataRetention: string | null;
  // Event details
  dateJoined: string;
  effectiveRetentions: Partial<
    Record<
      'span' | 'log' | 'traceMetric',
      {
        downsampled: number;
        standard: number;
      }
    >
  >;
  // GDPR Info
  gdprDetails: GDPRDetails | null;
  gracePeriodEnd: string | null;
  gracePeriodStart: string | null;
  hadCustomDynamicSampling: boolean;
  hasDismissedForcedTrialNotice: boolean;
  hasDismissedTrialEndingNotice: boolean;
  hasOverageNotificationsDisabled: boolean;
  hasRestrictedIntegration: boolean | null;
  hasSoftCap: boolean;
  id: string;
  isBundleEligible: boolean;

  // Added by SubscriptionStore to show/hide a UI element
  isEnterpriseTrial: boolean;
  // was the trial forced on to the org to rectify access to premium features
  isExemptFromForcedTrial: boolean;
  isForcedTrial: boolean;
  isFree: boolean;

  // Subscription flags
  isGracePeriod: boolean;
  isHeroku: boolean;
  isManaged: boolean;
  isOverMemberLimit: boolean;

  isPartner: boolean;
  isPastDue: boolean;
  isPerformancePlanTrial: boolean;
  isSelfServePartner: boolean;
  isSponsored: boolean;
  isSuspended: boolean;

  isTrial: boolean;
  lastTrialEnd: string | null;
  membersDeactivatedFromLimit: number;
  name: string;
  onDemandDisabled: boolean;
  onDemandInvoiced: boolean;
  onDemandMaxSpend: number;
  onDemandPeriodEnd: string;
  onDemandPeriodStart: string;
  onDemandSpendUsed: number;
  orgRetention: RetentionSettings | null;
  partner: Partner | null;
  paymentSource: {
    brand: string;
    countryCode: string | null;
    expMonth: number;
    expYear: number;
    last4: string;
    zipCode: string | null;
  } | null;
  pendingChanges: PendingChanges | null;
  // Subscription details
  plan: string;
  planDetails: Plan;
  planTier: string;
  /**
   * Total events allowed for the current usage period including gifted
   */
  renewalDate: string;
  slug: string;
  spendAllocationEnabled: boolean;
  sponsoredType: string | null;
  status: 'active' | 'trialing' | 'closed' | 'past_due';
  supportsOnDemand: boolean;
  suspensionReason: string | null;
  totalLicenses: number;
  totalMembers: number | null;
  totalProjects: number | null;
  trialEnd: string | null;
  trialPlan: string | null;
  trialTier: string | null;
  type: BillingType;
  /**
   * All quotas available on the plan are exceeded
   */
  usageExceeded: boolean;
  // Seats
  usedLicenses: number;
  acv?: number;
  addOns?: AddOns;
  // Billing information
  billingEmail?: string | null;
  channel?: string;
  /**
   * Optional without access, and possibly null with access
   */
  companyName?: string | null;
  contactInfo?: string | null;
  countryCode?: string | null;

  // Refetch usage data if Subscription is updated
  isDeleted?: boolean;

  isTrialStarted?: boolean;
  msaUpdatedForDataConsent?: boolean;
  onDemandBudgets?: SubscriptionOnDemandBudgets;
  onDemandInvoicedManual?: boolean | null;
  orgStatus?: {
    id: string;
    name: string;
  };

  owner?: {email: string; name: string};
  previousPaidPlans?: string[];

  productTrials?: ProductTrial[];
  reservedBudgets?: ReservedBudget[];
  // Added by SubscriptionStore
  setAt?: number;
  stats?: {
    events24h: number;
    events30d: number;
    eventsPrev24h: number;
    eventsPrev30d: number;
  };
  stripeCustomerID?: string;

  /**
   * Optional without access, and possibly null with access
   */
  vatID?: string | null;

  vatStatus?: VatStatus | null;
};

export type DiscountInfo = {
  amount: number;
  billingInterval: 'monthly' | 'annual';
  billingPeriods: number;
  // TODO: better typing
  creditCategory: InvoiceItemType | null;
  disclaimerText: string;
  discountType: 'percentPoints' | 'events';
  durationText: string;
  maxCentsPerPeriod: number;
  modalDisclaimerText: string;
  planRequirement: 'business' | 'paid' | null;
  reminderText: string;
};

export type Promotion = {
  autoOptIn: boolean;
  discountInfo: DiscountInfo;
  endDate: string;
  name: string;
  promptActivityTrigger: string | null;
  showDiscountInfo: boolean;
  slug: string;
  startDate: string;
  timeLimit: string;
};

export type PromotionClaimed = {
  dateClaimed: string;
  dateCompleted: string;
  dateExpired: string;
  freeEventCreditDaysLeft: number;
  isLastCycleForFreeEvents: boolean;
  promotion: Promotion;
  claimant?: User;
};

export type PromotionData = {
  activePromotions: PromotionClaimed[];
  availablePromotions: Promotion[];
  completedPromotions: PromotionClaimed[];
};

export type Feature = {
  description: string;
  name: string;
};

export type BillingConfig = {
  annualDiscount: number;
  defaultPlan: string;
  defaultReserved: Partial<Record<DataCategory, number>>;
  featureList: Record<string, Feature>;
  freePlan: string;
  id: string;
  planList: Plan[];
};

export type BillingStat = {
  accepted: number;
  date: string;
  dropped: {
    total: number;
    other?: number;
    overQuota?: number;
    spikeProtection?: number; // Calculated in UsageDetailItem
  };
  filtered: number;
  total: number;
  ts: string;
  // TODO(chart-cleanup): Used by v1 only
  isProjected?: boolean;
  /**
   * Not present when user does not have the correct role
   */
  onDemandCostRunningTotal?: number;
};
export type BillingStats = BillingStat[];

export type BillingStatTotal = {
  accepted: number;
  dropped: number;
  droppedOther: number;
  droppedOverQuota: number;
  droppedSpikeProtection: number;
  filtered: number;
  projected: number;
};

export type CustomerUsage = {
  onDemandEventsAllowed: number;
  onDemandMaxSpend: number;
  periodEnd: string;
  periodStart: string;
  stats: Record<string, BillingStats>;
  totals: Record<string, BillingStatTotal>;
  eventTotals?: Record<string, Record<string, BillingStatTotal>>;
};

type StructuredAddress = {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  countryCode: string | null;
  postalCode: string | null;
  region: string | null;
};

type TaxNumberName = {
  taxId: string;
  taxIdName: string;
};

type SentryTaxIds = TaxNumberName & {
  region?: TaxNumberName & {
    code: string;
  };
};

export type Charge = {
  amount: number;
  amountRefunded: number;
  cardLast4: string | null;
  dateCreated: string;
  failureCode: string | null;
  id: string;
  isPaid: boolean;
  isRefunded: boolean;
  stripeID: string | null;
};

export type InvoiceBase = StructuredAddress & {
  amount: number;
  amountBilled: number | null;
  amountRefunded: number;
  channel: string | null;
  chargeAttempts: number | null;
  creditApplied: number | null;
  dateCreated: string;
  displayAddress: string | null;
  id: string;
  isClosed: boolean;
  // guid
  isPaid: boolean;
  isRefunded: boolean;
  nextChargeAttempt: string | null;
  receipt: {
    url: string;
  };
  sentryTaxIds: SentryTaxIds | null;
  taxNumber: string | null;
  type: string | null;
};

export type Invoice = InvoiceBase & {
  charges: Charge[];
  customer:
    | Subscription
    | {
        id: string;
        isDeleted: boolean;
        slug: string;
        name?: string;
      };
  defaultTaxName: string | null;
  effectiveAt: string | null;
  isReverseCharge: boolean;
  items: InvoiceItem[];
  periodEnd: string | null;
  periodStart: string | null;
  sender: {
    address: string[];
    name: string;
  };
  stripeInvoiceID: string | null;
};

type BaseInvoiceItem = {
  amount: number;
  data: {period?: any; plan?: any; quantity?: any};
  description: string;
  type: InvoiceItemType;
};

export type InvoiceItem = BaseInvoiceItem & {
  periodEnd: string;
  periodStart: string;
};

/**
 * Converts camelCase string to snake_case. Consecutive capitals are treated as
 * a single acronym (e.g. "profileDurationUI" -> "profile_duration_ui").
 * Examples: "monitorSeats" -> "monitor_seats", "errors" -> "errors"
 */
type CamelToSnake<
  S extends string,
  Prev extends 'lower' | 'upper' | '' = '',
> = S extends `${infer First}${infer Rest}`
  ? First extends Lowercase<First>
    ? `${First}${CamelToSnake<Rest, 'lower'>}`
    : First extends Uppercase<First>
      ? Rest extends ''
        ? `${Prev extends '' ? '' : Prev extends 'lower' ? '_' : ''}${Lowercase<First>}`
        : Rest extends `${infer Next}${infer _Tail}`
          ? Next extends Lowercase<Next>
            ? `${Prev extends '' ? '' : '_'}${Lowercase<First>}${CamelToSnake<Rest, 'upper'>}`
            : `${Prev extends 'lower' ? '_' : ''}${Lowercase<First>}${CamelToSnake<Rest, 'upper'>}`
          : never
      : `${First}${CamelToSnake<Rest, Prev>}`
  : S;

/**
 * Dynamically generate ondemand invoice item types from DATA_CATEGORY_INFO.
 * This automatically includes new billing categories without manual enum updates.
 *
 * Follows the pattern: `ondemand_${snake_case_plural}`
 * Example: DATA_CATEGORY_INFO.ERROR (plural: "errors") -> "ondemand_errors"
 * Example: DATA_CATEGORY_INFO.MONITOR_SEAT (plural: "monitorSeats") -> "ondemand_monitor_seats"
 */
type OnDemandInvoiceItemType = {
  [K in keyof typeof DATA_CATEGORY_INFO]: (typeof DATA_CATEGORY_INFO)[K]['isBilledCategory'] extends true
    ? `ondemand_${CamelToSnake<(typeof DATA_CATEGORY_INFO)[K]['plural']>}`
    : never;
}[keyof typeof DATA_CATEGORY_INFO];

/**
 * Dynamically generate reserved invoice item types from DATA_CATEGORY_INFO.
 * This automatically includes new billing categories without manual enum updates.
 *
 * Follows the pattern: `reserved_${snake_case_plural}`
 * Example: DATA_CATEGORY_INFO.ERROR (plural: "errors") -> "reserved_errors"
 * Example: DATA_CATEGORY_INFO.MONITOR_SEAT (plural: "monitorSeats") -> "reserved_monitor_seats"
 */
type ReservedInvoiceItemType = {
  [K in keyof typeof DATA_CATEGORY_INFO]: (typeof DATA_CATEGORY_INFO)[K]['isBilledCategory'] extends true
    ? `reserved_${CamelToSnake<(typeof DATA_CATEGORY_INFO)[K]['plural']>}`
    : never;
}[keyof typeof DATA_CATEGORY_INFO];

/**
 * Credit-related invoice item types (discounts, credits, refunds).
 * Exported as const array to enable runtime usage in filters.
 */
export const CREDIT_INVOICE_ITEM_TYPES = [
  'subscription_credit',
  'recurring_discount',
  'discount',
  'credit_applied', // Deprecated: replaced by balance_change
] as const;

type CreditInvoiceItemType = (typeof CREDIT_INVOICE_ITEM_TYPES)[number];

/**
 * Fee-related invoice item types (taxes, penalties).
 * Exported as const array to enable runtime usage in filters.
 */
export const FEE_INVOICE_ITEM_TYPES = ['sales_tax', 'cancellation_fee'] as const;

type FeeInvoiceItemType = (typeof FEE_INVOICE_ITEM_TYPES)[number];

/**
 * Seer/AI-related invoice item types (special billing for AI features).
 */
const _SEER_INVOICE_ITEM_TYPES = [
  'reserved_seer_budget', // Special case: shared budget for seer_autofix and seer_scanner
  'reserved_seer_users', // Special case: reserved prevent users (PREVENT_USER category maps to this)
  'activated_seer_users', // Activation-based prevent users billing (PREVENT_USER category)
] as const;

type SeerInvoiceItemType = (typeof _SEER_INVOICE_ITEM_TYPES)[number];

/**
 * Legacy/deprecated invoice item types (AM1 plans and old formats).
 */
const _LEGACY_INVOICE_ITEM_TYPES = [
  'ondemand', // Legacy: generic ondemand for AM1 plans
  'attachments', // Legacy: AM1 plans
  'transactions', // Legacy: AM1 plans
  'daily_events', // Deprecated
  'reserved', // Deprecated: legacy name for reserved_events
] as const;

type LegacyInvoiceItemType = (typeof _LEGACY_INVOICE_ITEM_TYPES)[number];

/**
 * Core subscription type.
 */
type SubscriptionInvoiceItemType = 'subscription';

/**
 * Balance change can be both credit (negative) or fee (positive).
 */
type BalanceChangeInvoiceItemType = 'balance_change';

/**
 * Unknown invoice item type (empty string).
 */
type UnknownInvoiceItemType = '';

/**
 * Static invoice item types that are not tied to data categories.
 * These must be manually maintained but change infrequently.
 */
type StaticInvoiceItemType =
  | UnknownInvoiceItemType
  | SubscriptionInvoiceItemType
  | BalanceChangeInvoiceItemType
  | CreditInvoiceItemType
  | FeeInvoiceItemType
  | SeerInvoiceItemType
  | LegacyInvoiceItemType;

/**
 * Complete invoice item type union.
 * Automatically stays in sync with backend when new billing categories are added.
 *
 * Migration from enum: Use string literals instead of enum members.
 * Before: InvoiceItemType.SUBSCRIPTION
 * After:  'subscription'
 */
export type InvoiceItemType =
  | OnDemandInvoiceItemType
  | ReservedInvoiceItemType
  | StaticInvoiceItemType;

export enum InvoiceStatus {
  PAID = 'paid',
  CLOSED = 'closed',
  AWAITING_PAYMENT = 'awaiting payment',
}

export type BillingMetricHistory = {
  /**
   * Category name (e.g. "errors")
   */
  category: DataCategory;
  customPrice: number | null;
  free: number;
  onDemandBudget: number;
  onDemandQuantity: number;
  onDemandSpendUsed: number;
  /**
   * List order for billing metrics
   */
  order: number;
  paygCpe: number | null;
  prepaid: number;
  reserved: number | null;
  sentUsageWarning: boolean;
  // TODO(isabella): Make SoftCapType an enum
  softCapType: 'ON_DEMAND' | 'TRUE_FORWARD' | null;
  trueForward: boolean;
  usage: number;
  usageExceeded: boolean;
  retention?: {downsampled: number | null; standard: number};
};

export type BillingHistory = {
  categories: Record<string, BillingMetricHistory>;
  hadCustomDynamicSampling: boolean;
  id: string;
  isCurrent: boolean;
  links: {
    csv: string;
    csvPerProject: string;
  };
  onDemandBudgetMode: OnDemandBudgetMode;
  onDemandMaxSpend: number;
  onDemandSpend: number;
  periodEnd: string;
  // is today between periodStart/periodEnd?
  periodStart: string;
  plan: string;
  planName: string;
  reserved: Partial<Record<DataCategory, number | null>>;
  usage: Partial<Record<DataCategory, number>>;
  planDetails?: Plan;
  reservedBudgets?: ReservedBudget[];
};

export type PreviewData = {
  atPeriodEnd: boolean;
  balanceChange: number;
  billedAmount: number;
  creditApplied: number;
  effectiveAt: string;
  invoiceItems: PreviewInvoiceItem[];
  newBalance: number;
  previewToken: string;
  proratedAmount: number;
  paymentIntent?: string;
  paymentSecret?: string;
};

export type PreviewInvoiceItem = BaseInvoiceItem & {
  period_end: string;
  period_start: string;
};

/**
 * Dynamically generate credit types from DATA_CATEGORY_INFO.
 * Uses SINGULAR form (unlike InvoiceItemType which uses plural).
 * This automatically includes new billing categories without manual enum updates.
 *
 * Follows the pattern: snake_case of singular
 * Example: DATA_CATEGORY_INFO.ERROR (singular: "error") -> "error"
 * Example: DATA_CATEGORY_INFO.LOG_BYTE (singular: "logByte") -> "log_byte"
 */
type DynamicCreditType = {
  [K in keyof typeof DATA_CATEGORY_INFO]: (typeof DATA_CATEGORY_INFO)[K]['isBilledCategory'] extends true
    ? CamelToSnake<(typeof DATA_CATEGORY_INFO)[K]['singular']>
    : never;
}[keyof typeof DATA_CATEGORY_INFO];

/**
 * Static credit types not tied to data categories.
 * These must be manually maintained but change infrequently.
 */
type StaticCreditType =
  | 'discount' // Dollar-based recurring discount
  | 'percent' // Percentage-based recurring discount
  | 'seer_user'; // Special: maps to PREVENT_USER category (temporary until category renamed)

/**
 * Complete credit type union.
 * Automatically stays in sync with backend when new billing categories are added.
 *
 * Migration from enum: Use string literals instead of enum members.
 * Before: CreditType.ERROR
 * After:  'error'
 */
export type CreditType = DynamicCreditType | StaticCreditType;

type BaseRecurringCredit = {
  amount: number;
  id: number;
  periodEnd: string;
  periodStart: string;
};

interface RecurringDiscount extends BaseRecurringCredit {
  totalAmountRemaining: number;
  type: 'discount';
}

interface RecurringPercentDiscount extends BaseRecurringCredit {
  percentPoints: number;
  totalAmountRemaining: number;
  type: 'percent';
}

interface RecurringEventCredit extends BaseRecurringCredit {
  totalAmountRemaining: null;
  type:
    | 'error'
    | 'transaction'
    | 'span'
    | 'profile_duration'
    | 'profile_duration_ui'
    | 'attachment'
    | 'replay'
    | 'log_byte'
    | 'seer_user';
}

export type RecurringCredit =
  | RecurringDiscount
  | RecurringPercentDiscount
  | RecurringEventCredit;

export enum CohortId {
  SECOND = 2,
  THIRD = 3,
  FOURTH = 4,
  FIFTH = 5,
  SIXTH = 6,
  SEVENTH = 7,
  EIGHTH = 8,
  NINTH = 9,
  TENTH = 10,
  TEST_ONE = 111,
}

export type Cohort = {
  cohortId: CohortId;
  nextPlan: NextPlanInfo | null;
  secondDiscount: number;
};

export type NextPlanInfo = {
  contractPeriod: string;
  discountAmount: number;
  discountMonths: number;
  id: string;
  name: string;
  reserved: Partial<Record<DataCategory, number>>;
  totalPrice: number;
  categoryCredits?: Partial<
    Record<
      DataCategory,
      {
        credits: number;
        months: number;
      }
    >
  >;
};

export type PlanMigration = {
  cohort: Cohort | null;
  dateApplied: string | null;
  effectiveAt: string | null;
  id: number | string;
  planTier: string;
  recurringCredits: RecurringCredit[];
  scheduled: boolean;
};

export enum PlanTier {
  /**
   * Performance plans with continuous profiling
   * and dynamic sampling for spans.
   */
  AM3 = 'am3',
  /**
   * Performance plans with continuous profiling
   * and dynamic sampling for transactions.
   */
  AM2 = 'am2',
  /**
   * First generation of application monitoring plans.
   * Includes performance features.
   */
  AM1 = 'am1',
  /**
   * Monthly metered plans with variable data options.
   */
  MM2 = 'mm2',
  /**
   * First generation of monthly metered plans.
   * Features and data volumes are tightly coupled.
   */
  MM1 = 'mm1',
  /**
   * No specified tier
   */
  ALL = 'all',
  /**
   * Test plans
   */
  TEST = 'test',
}

// Response from /organizations/:orgSlug/payments/:invoiceId/new/
export type PaymentCreateResponse = {
  amount: string;
  clientSecret: string;
  currency: string;
  returnUrl: string;
};
// Response from /organizations/:orgSlug/payments/setup/
export type PaymentSetupCreateResponse = {
  clientSecret: string;
  id: string;
  lastError: string | null;
  status: string;
};

export enum FTCConsentLocation {
  CHECKOUT = 0,
  BILLING_DETAILS = 1,
}

export enum AddressType {
  STRUCTURED = 'structured',
  UNSTRUCTURED = 'unstructured',
}

export type BillingDetails = StructuredAddress & {
  addressType: AddressType | null;
  billingEmail: string | null;
  companyName: string | null;
  displayAddress: string | null;
  taxNumber: string | null;
};

export interface MonitorCountResponse {
  disabledMonitorCount: number;
  enabledMonitorCount: number;
  overQuotaMonitorCount: number;
}

export type PendingReservedBudget = {
  categories: Partial<Record<DataCategory, boolean | null>>;
  reservedBudget: number;
};

export type ReservedBudget = {
  /**
   * The categories included in the budget and their respective ReservedBudgetMetricHistory
   */
  categories: Partial<Record<DataCategory, ReservedBudgetMetricHistory>>;
  /**
   * The amount of free budget gifted in the associated usage cycle
   */
  freeBudget: number;
  /**
   * The id of the ReservedBudgetHistory object
   */
  id: string;
  /**
   * The percentage of the budget used, including gifted budget
   */
  percentUsed: number;
  /**
   * The amount of budget in the associated usage cycle, excluding gifted budget
   */
  reservedBudget: number;
  /**
   * The amount of budget used in the associated usage cycle
   */
  totalReservedSpend: number;
} & ReservedBudgetCategory;

export type ReservedBudgetMetricHistory = {
  reservedCpe: number; // in cents
  reservedSpend: number;
};

export type ReservedBudgetForCategory = {
  apiName: string;
  freeBudget: number;
  prepaidBudget: number;
  reservedCpe: number; // in cents
  reservedSpend: number;
  totalReservedBudget: number;
};

type PolicyConsent = {
  acceptedVersion: string;
  createdAt: string;
  userEmail: string;
  userName: string;
};

export type Policy = {
  active: boolean;
  /** Policy consent signature data if policy has been signed. Null if not signed or hasSignature is false. */
  consent: PolicyConsent | null;
  /** True if the policy can be signed. */
  hasSignature: boolean;
  /** Readable policy name */
  name: string;
  /** Slug of a parent policy that needs consent before this policy */
  parent: string | null;
  slug: string;
  /** True if no parent policies */
  standalone: boolean;
  /** The date of the current version */
  updatedAt: string | null;
  url: string | null;
  /** The current version */
  version: string | null;
};

type PolicyFile = {
  checksum: string;
  name: string;
  size: number;
};

export type PolicyRevision = {
  createdAt: string;
  current: boolean;
  file: PolicyFile | null;
  url: string | null;
  version: string;
};

export interface BilledDataCategoryInfo extends DataCategoryInfo {
  /**
   * Whether the category is supported for spend allocations
   */
  canAllocate: boolean;
  /**
   * Whether the category is supported for product trials
   */
  canProductTrial: boolean;
  /**
   * The tooltip text for the checkout page
   */
  checkoutTooltip: string | null;
  /**
   * The feature flag that enables the category
   */
  feature: string | null;
  /**
   * The event multiplier for gifts
   */
  freeEventsMultiple: number;
  /**
   * Has per-category PAYG
   */
  hasPerCategory: boolean;
  /**
   * Whether the category has spike protection support
   */
  hasSpikeProtection: boolean;
  /**
   * The maximum number of free events that can be gifted
   */
  maxAdminGift: number;
  /**
   * How usage is tallied for the category
   */
  tallyType: 'usage' | 'seat';
  /**
   * The shortened form of the singular unit name (ie. 'error', 'hour', 'monitor').
   */
  shortenedUnitName?: string;
}

type SeatStatus =
  | 'UNKNOWN'
  | 'ASSIGNED'
  | 'OVER_QUOTA'
  | 'DISABLED_FOR_BILLING'
  | 'REMOVED'
  | 'REALLOCATED';

export type BillingSeatAssignment = {
  billingMetric: DataCategory;
  created: string;
  displayName: string;
  id: number;
  isTrialSeat: boolean;
  projectId: number;
  seatIdentifier: string;
  status: SeatStatus;
};
