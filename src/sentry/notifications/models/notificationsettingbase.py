import sentry_sdk
from django.conf import settings
from django.db import models

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

    def save(self, *args, **kwargs):
        try:
            assert not (
                self.user_id is None and self.team_id is None
            ), "Notification setting missing user & team"
        except AssertionError as err:
            sentry_sdk.capture_exception(err)
        super().save(*args, **kwargs)
