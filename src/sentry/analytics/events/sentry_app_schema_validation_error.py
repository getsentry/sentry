from typing import Any

from sentry import analytics


@analytics.eventclass("sentry_app.schema_validation_error")
class SentryAppSchemaValidationError(analytics.Event):
    # TODO (fabian): rename back to schema once we've come back to use built-in dataclasses
    app_schema: str
    user_id: int | None = None
    sentry_app_id: int | None = None
    sentry_app_name: str
    organization_id: int
    error_message: str

    # TODO (fabian): see above
    def serialize(self) -> dict[str, Any]:
        serialized = super().serialize()
        serialized["schema"] = serialized.pop("app_schema")
        return serialized


analytics.register(SentryAppSchemaValidationError)
