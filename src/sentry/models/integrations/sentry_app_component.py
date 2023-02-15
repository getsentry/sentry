from django.db import models

from sentry.db.models import FlexibleForeignKey, Model, UUIDField, region_silo_only_model
from sentry.db.models.fields.jsonfield import JSONField


@region_silo_only_model
class SentryAppComponent(Model):
    __include_in_export__ = True

    uuid = UUIDField(unique=True, auto_add=True)
    sentry_app = FlexibleForeignKey("sentry.SentryApp", related_name="components")
    type = models.CharField(max_length=64)
    schema = JSONField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_sentryappcomponent"
