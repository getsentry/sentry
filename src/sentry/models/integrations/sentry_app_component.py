from django.db import models

from sentry.db.models import EncryptedJsonField, FlexibleForeignKey, Model, UUIDField


class SentryAppComponent(Model):
    __include_in_export__ = True

    uuid = UUIDField(unique=True, auto_add=True)
    sentry_app = FlexibleForeignKey("sentry.SentryApp", related_name="components")
    type = models.CharField(max_length=64)
    schema = EncryptedJsonField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_sentryappcomponent"
