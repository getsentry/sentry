from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    JSONField,
    Model,
    region_silo_only_model,
    sane_repr,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@region_silo_only_model
class PromptsActivity(Model):
    """Records user interaction with various feature prompts in product"""

    __relocation_scope__ = RelocationScope.Excluded

    organization_id = BoundedBigIntegerField(db_index=True)
    # Not a Foreign Key because it's no longer safe to take out lock on Project table in Prod
    project_id = BoundedBigIntegerField(db_index=True)
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, on_delete="CASCADE")
    feature = models.CharField(max_length=64, null=False)
    # typically will include a dismissed/snoozed timestamp or something similar
    data = JSONField(default={})

    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_promptsactivity"
        unique_together = (("user_id", "feature", "organization_id", "project_id"),)

    __repr__ = sane_repr("user_id", "feature")
