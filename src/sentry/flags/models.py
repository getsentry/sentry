from enum import Enum

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


class ActionEnum(Enum):
    CREATED = 0
    DELETED = 1
    UPDATED = 2

    @classmethod
    def to_string(cls, integer):
        if integer == 0:
            return "created"
        if integer == 1:
            return "deleted"
        if integer == 2:
            return "updated"
        raise ValueError


ACTION_MAP = {
    "created": ActionEnum.CREATED.value,
    "deleted": ActionEnum.DELETED.value,
    "updated": ActionEnum.UPDATED.value,
}


class CreatedByTypeEnum(Enum):
    EMAIL = 0
    ID = 1
    NAME = 2

    @classmethod
    def to_string(cls, integer):
        if integer == 0:
            return "email"
        if integer == 1:
            return "id"
        if integer == 2:
            return "name"
        raise ValueError


CREATED_BY_TYPE_MAP = {
    "email": CreatedByTypeEnum.EMAIL.value,
    "id": CreatedByTypeEnum.ID.value,
    "name": CreatedByTypeEnum.NAME.value,
}


class ProviderEnum(Enum):
    GENERIC = 0
    FLAGPOLE = 1
    LAUNCHDARKLY = 2
    UNLEASH = 3
    STATSIG = 4

    @classmethod
    def to_string(cls, integer):
        if integer == 0:
            return "generic"
        if integer == 1:
            return "flagpole"
        if integer == 2:
            return "launchdarkly"
        if integer == 3:
            return "unleash"
        if integer == 4:
            return "statsig"
        raise ValueError


PROVIDER_MAP = {
    "generic": ProviderEnum.GENERIC.value,
    "flagpole": ProviderEnum.FLAGPOLE.value,
    "launchdarkly": ProviderEnum.LAUNCHDARKLY.value,
    "unleash": ProviderEnum.UNLEASH.value,
    "statsig": ProviderEnum.STATSIG.value,
}


@region_silo_model
class FlagAuditLogModel(Model):
    __relocation_scope__ = RelocationScope.Excluded

    ACTION_TYPES = (
        (ActionEnum.CREATED, "created"),
        (ActionEnum.UPDATED, "updated"),
        (ActionEnum.DELETED, "deleted"),
    )
    CREATED_BY_TYPE_TYPES = (
        (CreatedByTypeEnum.EMAIL, "email"),
        (CreatedByTypeEnum.NAME, "name"),
        (CreatedByTypeEnum.ID, "id"),
    )
    PROVIDER_TYPES = (
        (ProviderEnum.GENERIC, "generic"),
        (ProviderEnum.FLAGPOLE, "flagpole"),
        (ProviderEnum.LAUNCHDARKLY, "launchdarkly"),
        (ProviderEnum.UNLEASH, "unleash"),
        (ProviderEnum.STATSIG, "statsig"),
    )
    action = models.PositiveSmallIntegerField(choices=ACTION_TYPES)
    created_at = models.DateTimeField(default=timezone.now)
    created_by = models.CharField(max_length=100, null=True)
    created_by_type = models.PositiveSmallIntegerField(choices=CREATED_BY_TYPE_TYPES, null=True)
    flag = models.CharField(max_length=100)
    organization_id = HybridCloudForeignKey("sentry.Organization", null=False, on_delete="CASCADE")
    provider = models.PositiveSmallIntegerField(choices=PROVIDER_TYPES, null=True)
    tags = models.JSONField()

    class Meta:
        app_label = "flags"
        db_table = "flags_audit_log"
        indexes = (models.Index(fields=("flag",)),)

    __repr__ = sane_repr("organization_id", "flag")


@region_silo_model
class FlagWebHookSigningSecretModel(Model):
    __relocation_scope__ = RelocationScope.Excluded

    created_by = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL")
    date_added = models.DateTimeField(default=timezone.now)
    organization = FlexibleForeignKey("sentry.Organization")
    provider = models.CharField(db_index=True)
    secret = models.CharField()

    class Meta:
        app_label = "flags"
        db_table = "flags_webhooksigningsecret"
        unique_together = (("organization", "provider", "secret"),)
