from collections.abc import Iterable

import sentry_sdk
from django.conf import settings
from django.db import models
from django.db.models.base import ModelBase

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedBigIntegerField, DefaultFieldsModelExisting, FlexibleForeignKey
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


class NotificationSettingBase(DefaultFieldsModelExisting):
    __relocation_scope__ = RelocationScope.Excluded

    scope_type = models.CharField(max_length=32, null=False)
    scope_identifier = BoundedBigIntegerField(null=False)
    team_id = HybridCloudForeignKey("sentry.Team", null=True, db_index=True, on_delete="CASCADE")
    user = FlexibleForeignKey(
        settings.AUTH_USER_MODEL, null=True, db_index=True, on_delete=models.CASCADE
    )
    type = models.CharField(max_length=32, null=False)
    value = models.CharField(max_length=32, null=False)

    class Meta:
        abstract = True

    def save(
        self,
        *,
        force_insert: bool | tuple[ModelBase, ...] = False,
        force_update: bool = False,
        using: str | None = None,
        update_fields: Iterable[str] | None = None,
    ) -> None:
        try:
            assert not (not self.user_id and not self.team_id), (
                "Notification setting missing user & team"
            )
        except AssertionError as err:
            sentry_sdk.capture_exception(err)
        super().save(
            force_insert=force_insert,
            force_update=force_update,
            using=using,
            update_fields=update_fields,
        )
