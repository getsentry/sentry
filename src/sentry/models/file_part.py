from django.db import models
from django.utils import timezone

from sentry.db.models import Model, region_silo_only_model


@region_silo_only_model
class FilePartModel(Model):
    __include_in_export__ = False

    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    dek = models.CharField(max_length=64, null=True)
    end = models.IntegerField()
    filename = models.CharField(max_length=32)
    is_archived = models.BooleanField()
    key = models.CharField(max_length=64, db_index=True)
    start = models.IntegerField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_blob_range"
