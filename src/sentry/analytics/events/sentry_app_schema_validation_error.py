from typing import int
from sentry import analytics


@analytics.eventclass("sentry_app.schema_validation_error")
class SentryAppSchemaValidationError(analytics.Event):
    schema: str
    user_id: int | None = None
    sentry_app_id: int | None = None
    sentry_app_name: str
    organization_id: int
    error_message: str


analytics.register(SentryAppSchemaValidationError)
