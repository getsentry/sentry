from django.db import models

from sentry.db.models import BoundedPositiveIntegerField, Model, region_silo_only_model
from sentry.types.issues import GroupCategory


@region_silo_only_model
class GroupType(Model):
    __include_in_export__ = False

    slug = models.CharField(max_length=254, unique=True)
    description = models.CharField(max_length=254, unique=True)
    category = BoundedPositiveIntegerField(
        choices=[(category.value, category.name.lower()) for category in GroupCategory],
        default=GroupCategory.ERROR.value,
    )
    ignore_limit = models.IntegerField(default=3, null=False)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_grouptype"
        unique_together = (("slug", "description"),)
