import type {DATA_CATEGORY_INFO} from 'sentry/constants';
import type {DataCategoryExact} from 'sentry/types/core';
import type {User} from 'sentry/types/user';

declare global {
  interface Window {
    /**
     * Stripe SDK
     */
    Stripe: stripe.Stripe;
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
     * Pendo which is used to render guides
     */
    pendo?: any; // TODO: use types package
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
}

export enum CheckoutType {
  STANDARD = 'standard',
  BUNDLE = 'bundle',
}

export type DataCategories = (typeof DATA_CATEGORY_INFO)[DataCategoryExact]['plural'];

export type Plan = {
  allowAdditionalReservedEvents: boolean;
  allowOnDemand: boolean;
  /**
   * All available data categories on the current plan tier.
   * Can be used for category upsells.
   */
  availableCategories: string[];
  basePrice: number;
  billingInterval: 'monthly' | 'annual';
  /**
   * Data categories on the plan (errors, transactions, etc.)
   */
  categories: string[];
  checkoutCategories: string[];
  contractInterval: 'monthly' | 'annual';
  description: string;
  features: string[];
  hasOnDemandModes: boolean;

  id: string;
  maxMembers: number | null;
  name: string;
  onDemandCategories: string[];
  onDemandEventPrice: number;
  planCategories: {
    [categoryKey in DataCategories]?: EventBucket[];
  };
  price: number;
  reservedMinimum: number;

  retentionDays: number;
  totalPrice: number;
  trialPlan: string | null;
  userSelectable: boolean;
  categoryDisplayNames?: {
    [categoryKey in DataCategories]?: {plural: string; singular: string};
  };
  checkoutType?: CheckoutType;
};

type PendingChanges = {
  customPrice: number | null;
  customPriceAttachments: number | null;
  customPriceErrors: number | null;
  customPricePcss: number | null;
  customPriceTransactions: number | null;
  // TODO:categories remove customPrice{Categories}
  customPrices: {[categoryKey in DataCategories]?: number | null};
  effectiveDate: string;
  onDemandBudgets: PendingOnDemandBudgets | null;
  onDemandEffectiveDate: string;
  onDemandMaxSpend: number;
  plan: string;
  planDetails: Plan;
  planName: string;
  // TODO:categories remove reserved{Categories}
  reserved: {[categoryKey in DataCategories]?: number | null};
  reservedAttachments: number | null;
  reservedBudgets: PendingReservedBudget[];
  reservedCpe: {[categoryKey in DataCategories]?: number | null};
  reservedErrors: number | null;
  reservedEvents: number;
  reservedTransactions: number | null;
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

type SharedOnDemandBudget = {
  budgetMode: OnDemandBudgetMode.SHARED;
  sharedMaxBudget: number;
};

type SharedOnDemandBudgetWithSpends = SharedOnDemandBudget & {
  onDemandSpendUsed: number;
};

export type PerCategoryOnDemandBudget = {
  attachmentsBudget: number;
  budgetMode: OnDemandBudgetMode.PER_CATEGORY;
  // TODO:categories remove {categories}Budget
  budgets: {[categoryKey in DataCategories]?: number};
  errorsBudget: number;
  replaysBudget: number;
  transactionsBudget: number;
  monitorSeatsBudget?: number;
  uptimeBudget?: number;
};

type PerCategoryOnDemandBudgetWithSpends = PerCategoryOnDemandBudget & {
  attachmentSpendUsed: number;
  errorSpendUsed: number;
  transactionSpendUsed: number;
  // TODO:categories remove {categories}SpendUsed
  usedSpends: {[categoryKey in DataCategories]?: number};
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
  category: DataCategories;
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
  categories: {
    [categoryKey in DataCategories]?: BillingMetricHistory;
  };
  contractInterval: 'monthly' | 'annual';

  contractPeriodEnd: string;
  contractPeriodStart: string;
  customPrice: number | null;
  customPriceAttachments: number | null;
  customPriceErrors: number | null;
  customPricePcss: number | null;
  customPriceTransactions: number | null;
  dataRetention: string | null;
  // Event details
  dateJoined: string;
  // GDPR Info
  gdprDetails: GDPRDetails | null;
  gracePeriodEnd: string | null;
  gracePeriodStart: string | null;
  hadCustomDynamicSampling: boolean;
  hasDismissedForcedTrialNotice: boolean;
  hasDismissedTrialEndingNotice: boolean;
  hasOverageNotificationsDisabled: boolean;
  hasReservedBudgets: boolean;
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
  partner: Partner | null;
  paymentSource: {
    countryCode: string;
    expMonth: number;
    expYear: number;
    last4: string;
    zipCode: string;
  } | null;
  pendingChanges: PendingChanges | null;
  // Subscription details
  plan: string;
  planDetails: Plan;
  planTier: string;
  /**
   * Total events allowed for the current usage period including gifted
   */
  prepaidEventsAllowed: number | null;
  renewalDate: string;
  reservedAttachments: number | null;
  reservedBudgetCategories: string[] | null;
  /**
   * For am1 plan tier, null for previous tiers
   */
  reservedErrors: number | null;
  /**
   * Reserved events on a recurring subscription
   * For plan tiers previous to am1
   */
  reservedEvents: number;
  reservedTransactions: number | null;
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

  trueForward?: {attachment: boolean; error: boolean; transaction: boolean};

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
  creditCategory: string;
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

/** @internal exported for tests only */
export type Feature = {
  description: string;
  name: string;
};

export type BillingConfig = {
  annualDiscount: number;
  defaultPlan: string;
  defaultReserved: {
    [categoryKey in DataCategories]?: number;
  };
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
  stats: {[key: string]: BillingStats};
  totals: {[key: string]: BillingStatTotal};
  eventTotals?: {[key: string]: {[key: string]: BillingStatTotal}};
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
  charges: any[];
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

export enum InvoiceItemType {
  UNKOWN = '',
  SUBSCRIPTION = 'subscription',
  ONDEMAND = 'ondemand',
  RESERVED_EVENTS = 'reserved',
  DAILY_EVENTS = 'daily_events',
  BALANCE_CHANGE = 'balance_change',
  CANCELLATION_FEE = 'cancellation_fee',
  SUBSCRIPTION_CREDIT = 'subscription_credit',
  CREDIT_APPLIED = 'credit_applied',
  /**
   * Used for am1 plans
   */
  ATTACHMENTS = 'attachments',
  TRANSACTIONS = 'transactions',
  ONDEMAND_ATTACHMENTS = 'ondemand_attachments',
  ONDEMAND_ERRORS = 'ondemand_errors',
  ONDEMAND_TRANSACTIONS = 'ondemand_transactions',
  ONDEMAND_REPLAYS = 'ondemand_replays',
  ONDEMAND_SPANS = 'ondemand_spans',
  ONDEMAND_SPANS_INDEXED = 'ondemand_spans_indexed',
  ONDEMAND_MONITOR_SEATS = 'ondemand_monitor_seats',
  ONDEMAND_UPTIME = 'ondemand_uptime',
  ONDEMAND_PROFILE_DURATION = 'ondemand_profile_duration',
  RESERVED_ATTACHMENTS = 'reserved_attachments',
  RESERVED_ERRORS = 'reserved_errors',
  RESERVED_TRANSACTIONS = 'reserved_transactions',
  RESERVED_REPLAYS = 'reserved_replays',
  RESERVED_SPANS = 'reserved_spans',
  RESERVED_SPANS_INDEXED = 'reserved_spans_indexed',
  RESERVED_MONITOR_SEATS = 'reserved_monitor_seats',
  RESERVED_UPTIME = 'reserved_uptime',
  RESERVED_PROFILE_DURATION = 'reserved_profile_duration',
}

export enum InvoiceStatus {
  PAID = 'paid',
  CLOSED = 'closed',
  AWAITING_PAYMENT = 'awaiting payment',
}

export type BillingMetricHistory = {
  /**
   * Category name (e.g. "errors")
   */
  category: string;
  customPrice: number | null;
  free: number;
  onDemandBudget: number;
  onDemandCpe: number | null;
  onDemandQuantity: number;
  onDemandSpendUsed: number;
  /**
   * List order for billing metrics
   */
  order: number;
  prepaid: number;
  reserved: number | null;
  sentUsageWarning: boolean;
  softCapType: 'ON_DEMAND' | 'TRUE_FORWARD' | null;
  trueForward: boolean;
  usage: number;
  usageExceeded: boolean;
};

export type BillingHistory = {
  categories: {[key: string]: BillingMetricHistory};
  hasReservedBudgets: boolean;
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
  reserved: {
    [categoryKey in DataCategories]?: number | null;
  };
  reservedBudgetCategories: string[];
  usage: {
    [categoryKey in DataCategories]?: number;
  };
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

type PreviewInvoiceItem = BaseInvoiceItem & {
  period_end: string;
  period_start: string;
};

export enum CreditType {
  ERROR = 'error',
  TRANSACTION = 'transaction',
  SPAN = 'span',
  SPAN_INDEXED = 'spanIndexed',
  PROFILE_DURATION = 'profileDuration',
  ATTACHMENT = 'attachment',
  REPLAY = 'replay',
  MONITOR_SEAT = 'monitorSeat',
  DISCOUNT = 'discount',
  PERCENT = 'percent',
  UPTIME = 'uptime',
}

type BaseRecurringCredit = {
  amount: number;
  id: number;
  periodEnd: string;
  periodStart: string;
};

interface RecurringDiscount extends BaseRecurringCredit {
  totalAmountRemaining: number;
  type: CreditType.DISCOUNT;
}

interface RecurringPercentDiscount extends BaseRecurringCredit {
  percentPoints: number;
  totalAmountRemaining: number;
  type: CreditType.PERCENT;
}

interface RecurringEventCredit extends BaseRecurringCredit {
  totalAmountRemaining: null;
  type:
    | CreditType.ERROR
    | CreditType.TRANSACTION
    | CreditType.SPAN
    | CreditType.PROFILE_DURATION
    | CreditType.ATTACHMENT
    | CreditType.REPLAY;
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
}

/** @internal exported for tests only */
export type Cohort = {
  cohortId: CohortId;
  nextPlan: NextPlanInfo | null;
  secondDiscount: number;
};

export type NextPlanInfo = {
  contractPeriod: string;
  discountAmount: number;
  discountMonths: number;
  errorCredits: number;
  errorCreditsMonths: number;
  id: string;
  name: string;
  reserved: {
    [categoryKey in DataCategories]?: number;
  };
  reservedAttachments: number;
  reservedErrors: number;
  totalPrice: number;
  categoryCredits?: {
    [categoryKey in DataCategories]?: {
      credits: number;
      months: number;
    };
  };
  reservedTransactions?: number;
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
  categories: {[categoryKey in DataCategories]?: boolean | null};
  reservedBudget: number;
};

export type ReservedBudget = {
  categories: {
    [categoryKey in DataCategories]?: ReservedBudgetMetricHistory;
  };
  freeBudget: number;
  id: string;
  percentUsed: number;
  reservedBudget: number;
  totalReservedSpend: number;
};

export type ReservedBudgetMetricHistory = {
  reservedCpe: number; // in cents
  reservedSpend: number;
};

export type ReservedBudgetForCategory = {
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
