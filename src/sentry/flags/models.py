from enum import Enum

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model, region_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


class ActionEnum(Enum):
    CREATED = 0
    DELETED = 1
    UPDATED = 2


ACTION_MAP = {
    "created": ActionEnum.CREATED.value,
    "deleted": ActionEnum.DELETED.value,
    "updated": ActionEnum.UPDATED.value,
}


class ModifiedByTypeEnum(Enum):
    EMAIL = 0
    ID = 1
    NAME = 2


MODIFIED_BY_TYPE_MAP = {
    "email": ModifiedByTypeEnum.EMAIL.value,
    "id": ModifiedByTypeEnum.ID.value,
    "name": ModifiedByTypeEnum.NAME.value,
}


@region_silo_model
class FlagAuditLogModel(Model):
    __relocation_scope__ = RelocationScope.Excluded

    ACTION_TYPES = (
        (ActionEnum.CREATED, "created"),
        (ActionEnum.UPDATED, "updated"),
        (ActionEnum.DELETED, "deleted"),
    )
    MODIFIED_BY_TYPE_TYPES = (
        (ModifiedByTypeEnum.EMAIL, "email"),
        (ModifiedByTypeEnum.NAME, "name"),
        (ModifiedByTypeEnum.ID, "id"),
    )

    action = models.PositiveSmallIntegerField(choices=ACTION_TYPES)
    flag = models.CharField(max_length=100)
    modified_at = models.DateTimeField(default=timezone.now)
    modified_by = models.CharField(max_length=100)
    modified_by_type = models.PositiveSmallIntegerField(choices=MODIFIED_BY_TYPE_TYPES)
    organization_id = HybridCloudForeignKey("sentry.Organization", null=False, on_delete="CASCADE")
    tags = models.JSONField()

    class Meta:
        app_label = "flags"
        db_table = "flags_audit_log"
        indexes = (models.Index(fields=("flag",)),)

    __repr__ = sane_repr("organization_id", "flag")
