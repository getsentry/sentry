from __future__ import annotations

from collections.abc import MutableMapping
from typing import Any

from django.db import models

from sentry.backup.dependencies import NormalizedModelName, get_model_name
from sentry.backup.sanitize import SanitizableField, Sanitizer
from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, UUIDField, control_silo_model
from sentry.db.models.fields.jsonfield import JSONField


@control_silo_model
class SentryAppComponent(Model):
    __relocation_scope__ = RelocationScope.Global

    uuid = UUIDField(unique=True, auto_add=True)
    sentry_app = FlexibleForeignKey("sentry.SentryApp", related_name="components")
    type = models.CharField(max_length=64)
    schema: models.Field[dict[str, Any], dict[str, Any]] = JSONField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_sentryappcomponent"

    @property
    def app_schema(self) -> MutableMapping[str, Any]:
        """Provides consistent interface with RpcSentryAppComponent"""
        return self.schema

    @classmethod
    def sanitize_relocation_json(
        cls, json: Any, sanitizer: Sanitizer, model_name: NormalizedModelName | None = None
    ) -> None:
        model_name = get_model_name(cls) if model_name is None else model_name
        super().sanitize_relocation_json(json, sanitizer, model_name)

        sanitizer.set_string(json, SanitizableField(model_name, "type"))
        sanitizer.set_json(json, SanitizableField(model_name, "schema"), {})
