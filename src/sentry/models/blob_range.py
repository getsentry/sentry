from django.db import models
from django.utils import timezone

from sentry.db.models import Model, region_silo_only_model


@region_silo_only_model
class BlobRangeModel(Model):
    key = models.CharField(db_index=True)
    start = models.IntegerField()
    stop = models.IntegerField()
    dek = models.BinaryField()
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_blob_range"
