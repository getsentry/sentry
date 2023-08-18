from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, UUIDField, control_silo_only_model
from sentry.db.models.fields.jsonfield import JSONField


@control_silo_only_model
class SentryAppComponent(Model):
    __relocation_scope__ = RelocationScope.Global

    uuid = UUIDField(unique=True, auto_add=True)
    sentry_app = FlexibleForeignKey("sentry.SentryApp", related_name="components")
    type = models.CharField(max_length=64)
    schema = JSONField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_sentryappcomponent"
