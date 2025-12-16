from sentry.billing.interface import BillingService
from sentry.billing.sentry import SentryUsageTrackingService


class Service(BillingService):
    usage_tracking = SentryUsageTrackingService()


billing_service = Service()
