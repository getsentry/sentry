from uuid import uuid4

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_only_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


def default_uuid():
    return uuid4().hex


@region_silo_only_model
class GroupShare(Model):
    """
    A Group that was shared publicly.
    """

    __relocation_scope__ = RelocationScope.Excluded

    project = FlexibleForeignKey("sentry.Project")
    group = FlexibleForeignKey("sentry.Group", unique=True)
    uuid = models.CharField(max_length=32, unique=True, default=default_uuid)
    # Tracking the user that initiated the share.
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, on_delete="CASCADE", null=True)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupshare"

    __repr__ = sane_repr("project_id", "group_id", "uuid")
