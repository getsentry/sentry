from sentry import analytics


@analytics.eventclass("sentry_app.schema_validation_error")
class SentryAppSchemaValidationError(analytics.Event):
    schema: str
    user_id: str
    sentry_app_id: str | None = None
    sentry_app_name: str
    organization_id: str
    error_message: str


analytics.register(SentryAppSchemaValidationError)
