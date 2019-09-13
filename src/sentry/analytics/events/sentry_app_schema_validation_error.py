from __future__ import absolute_import

from sentry import analytics


class SentryAppSchemaValidationError(analytics.Event):
    type = "sentry_app.schema_validation_error"

    attributes = (
        analytics.Attribute("schema"),
        analytics.Attribute("user_id"),
        analytics.Attribute("sentry_app_id", required=False),
        analytics.Attribute("sentry_app_name"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("error_message"),
    )


analytics.register(SentryAppSchemaValidationError)
