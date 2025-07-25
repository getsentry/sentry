from typing import Any

from sentry import analytics


@analytics.eventclass("sentry_app.schema_validation_error")
class SentryAppSchemaValidationError(analytics.Event):
    app_schema: str
    user_id: int
    sentry_app_id: int | None = None
    sentry_app_name: str
    organization_id: int
    error_message: str

    def serialize(self) -> dict[str, Any]:
        # with pydantic dataclasses we are prohibited to have a field named "schema"
        # so we need to rename it to "app_schema" and replace it while serializing
        # TODO: when moving from pydantic we can remove this shim
        serialized = super().serialize()
        serialized["data"]["schema"] = serialized["data"].pop("app_schema")
        return serialized


analytics.register(SentryAppSchemaValidationError)
