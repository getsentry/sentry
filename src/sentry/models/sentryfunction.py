from django.db import models

from sentry.db.models import BaseManager, DefaultFieldsModel, EncryptedJsonField, FlexibleForeignKey
from sentry.db.models.fields.array import ArrayField


class SentryFunction(DefaultFieldsModel):
    __include_in_export__ = False

    organization = FlexibleForeignKey("sentry.Organization")
    name = models.TextField()
    slug = models.CharField(max_length=64, unique=True)
    author = models.TextField()
    external_id = models.CharField(max_length=128, unique=True)
    overview = models.TextField(null=True)
    code = models.TextField(null=True)
    events = ArrayField(of=models.TextField, null=True)
    env_variables = EncryptedJsonField(default=dict)
    objects = BaseManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_sentryfunction"
        unique_together = (("organization", "slug"),)
