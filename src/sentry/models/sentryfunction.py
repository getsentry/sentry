from django.db import models

from sentry.db.models import BaseManager, DefaultFieldsModel, FlexibleForeignKey


class SentryFunction(DefaultFieldsModel):
    __include_in_export__ = False

    organization = FlexibleForeignKey("sentry.Organization")
    name = models.TextField()
    slug = models.CharField(max_length=64, unique=True)
    author = models.TextField()
    external_id = models.CharField(max_length=128, unique=True)

    objects = BaseManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_sentryfunction"
        unique_together = (("organization", "slug"),)
