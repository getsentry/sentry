from typing import Protocol

from sentry.billing.usage import UsageTrackingService


class BillingService(Protocol):
    usage_tracking: UsageTrackingService
    # plan_management: PlanManagementService
    # customer_billing: CustomerBillingService
    # quota_management: QuotaManagementService
    # committed_spend: CommittedSpendService
    # billing_calculation: BillingCalculationService
    # invoicing: InvoicingService
