from __future__ import annotations

from typing import FrozenSet, List

from django.db import models

from sentry.backup.dependencies import ImportKind, PrimaryKeyMap, get_model_name
from sentry.backup.helpers import ImportFlags
from sentry.backup.mixins import OverwritableConfigMixin
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.db.models import FlexibleForeignKey, control_silo_only_model, sane_repr
from sentry.db.models.outboxes import ControlOutboxProducingModel
from sentry.models.outbox import ControlOutboxBase, OutboxCategory
from sentry.types.region import find_regions_for_user


@control_silo_only_model
class UserPermission(OverwritableConfigMixin, ControlOutboxProducingModel):
    """
    Permissions are applied to administrative users and control explicit scope-like permissions within the API.

    Generally speaking, they should only apply to active superuser sessions.
    """

    __relocation_scope__ = RelocationScope.Config
    __relocation_custom_ordinal__ = ["user", "permission"]

    user = FlexibleForeignKey("sentry.User")
    # permissions should be in the form of 'service-name.permission-name'
    permission = models.CharField(max_length=32)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_userpermission"
        unique_together = (("user", "permission"),)

    __repr__ = sane_repr("user_id", "permission")

    @classmethod
    def for_user(cls, user_id: int) -> FrozenSet[str]:
        """
        Return a set of permission for the given user ID.
        """
        return frozenset(cls.objects.filter(user=user_id).values_list("permission", flat=True))

    def outboxes_for_update(self, shard_identifier: int | None = None) -> List[ControlOutboxBase]:
        regions = find_regions_for_user(self.user_id)
        return [
            outbox
            for outbox in OutboxCategory.USER_UPDATE.as_control_outboxes(
                region_names=regions,
                shard_identifier=self.user_id,
                object_identifier=self.user_id,
            )
        ]

    def normalize_before_relocation_import(
        self, pk_map: PrimaryKeyMap, scope: ImportScope, flags: ImportFlags
    ) -> int | None:
        from sentry.models.user import User

        old_user_id = self.user_id
        old_pk = super().normalize_before_relocation_import(pk_map, scope, flags)
        if old_pk is None:
            return None

        # If we are merging users, ignore the imported permissions and use the existing user's
        # permissions instead.
        if pk_map.get_kind(get_model_name(User), old_user_id) == ImportKind.Existing:
            return None

        return old_pk
