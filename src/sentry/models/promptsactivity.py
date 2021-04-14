from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    JSONField,
    Model,
    sane_repr,
)


class PromptsActivity(Model):
    """ Records user interaction with various feature prompts in product"""

    __core__ = False

    organization_id = BoundedPositiveIntegerField(db_index=True)
    # Not a Foreign Key because it's no longer safe to take out lock on Project table in Prod
    project_id = BoundedPositiveIntegerField(db_index=True)
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, null=False)
    feature = models.CharField(max_length=64, null=False)
    # typically will include a dismissed/snoozed timestamp or something similar
    data = JSONField(default={})

    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_promptsactivity"
        unique_together = (("user", "feature", "organization_id", "project_id"),)

    __repr__ = sane_repr("user_id", "feature")
