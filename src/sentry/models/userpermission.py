from __future__ import annotations

from typing import FrozenSet, List, Optional, Tuple

from django.db import models

from sentry.backup.dependencies import ImportKind
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.db.models import FlexibleForeignKey, control_silo_only_model, sane_repr
from sentry.db.models.outboxes import ControlOutboxProducingModel
from sentry.models.outbox import ControlOutboxBase, OutboxCategory
from sentry.types.region import find_regions_for_user


@control_silo_only_model
class UserPermission(ControlOutboxProducingModel):
    """
    Permissions are applied to administrative users and control explicit scope-like permissions within the API.

    Generally speaking, they should only apply to active superuser sessions.
    """

    __relocation_scope__ = RelocationScope.Config

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

    def write_relocation_import(
        self, _s: ImportScope, _f: ImportFlags
    ) -> Optional[Tuple[int, ImportKind]]:
        # Ensure that we never attempt to duplicate `UserPermission` entries, even when the
        # `merge_users` flag is enabled, as they must always be globally unique per user.
        (up, created) = self.__class__.objects.get_or_create(
            user_id=self.user_id, permission=self.permission
        )
        if up:
            self.pk = up.pk
            self.save()

        return (self.pk, ImportKind.Inserted if created else ImportKind.Existing)
