from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model


class GroupCategory(Model):
    __core__ = False

    group = FlexibleForeignKey("sentry.Group")
    category = models.TextField(null=False, db_index=True)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupcategory"
