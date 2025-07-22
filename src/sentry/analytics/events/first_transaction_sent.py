from sentry import analytics


@analytics.eventclass("first_transaction.sent")
class FirstTransactionSentEvent(analytics.Event):
    organization_id: str
    project_id: int
    platform: str | None = None
    default_user_id: int | None = None


analytics.register(FirstTransactionSentEvent)
