from __future__ import annotations

from typing import FrozenSet, List

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.backup.mixins import OverwritableConfigMixin
from sentry.backup.scopes import RelocationScope
from sentry.db.models import ArrayField, control_silo_only_model, sane_repr
from sentry.db.models.fields.foreignkey import FlexibleForeignKey
from sentry.db.models.outboxes import ControlOutboxProducingModel
from sentry.models.outbox import ControlOutboxBase, OutboxCategory
from sentry.signals import post_upgrade
from sentry.silo import SiloMode
from sentry.types.region import find_all_region_names

MAX_USER_ROLE_NAME_LENGTH = 32


@control_silo_only_model
class UserRole(OverwritableConfigMixin, ControlOutboxProducingModel):
    """
    Roles are applied to administrative users and apply a set of `UserPermission`.
    """

    __relocation_scope__ = RelocationScope.Config
    __relocation_custom_ordinal__ = ["name"]

    date_updated = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now, null=True)

    name = models.CharField(max_length=MAX_USER_ROLE_NAME_LENGTH, unique=True)
    permissions = ArrayField()
    users = models.ManyToManyField("sentry.User", through="sentry.UserRoleUser")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_userrole"

    __repr__ = sane_repr("name", "permissions")

    def outboxes_for_update(self, shard_identifier: int | None = None) -> List[ControlOutboxBase]:
        regions = list(find_all_region_names())
        return [
            outbox
            for user_id in self.users.values_list("id", flat=True)
            for outbox in OutboxCategory.USER_UPDATE.as_control_outboxes(
                region_names=regions,
                shard_identifier=user_id,
                object_identifier=user_id,
            )
        ]

    @classmethod
    def permissions_for_user(cls, user_id: int) -> FrozenSet[str]:
        """
        Return a set of permission for the given user ID scoped to roles.
        """
        return frozenset(
            i
            for sl in cls.objects.filter(users=user_id).values_list("permissions", flat=True)
            for i in sl
        )


@control_silo_only_model
class UserRoleUser(ControlOutboxProducingModel):
    __relocation_scope__ = RelocationScope.Config

    date_updated = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now, null=True)

    user = FlexibleForeignKey("sentry.User")
    role = FlexibleForeignKey("sentry.UserRole")

    def outboxes_for_update(self, shard_identifier: int | None = None) -> List[ControlOutboxBase]:
        regions = list(find_all_region_names())
        return OutboxCategory.USER_UPDATE.as_control_outboxes(
            region_names=regions,
            shard_identifier=self.user_id,
            object_identifier=self.user_id,
        )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_userrole_users"

    __repr__ = sane_repr("user", "role")


# this must be idempotent because it executes on every upgrade
def manage_default_super_admin_role(**kwargs):
    role, _ = UserRole.objects.get_or_create(
        name="Super Admin", defaults={"permissions": settings.SENTRY_USER_PERMISSIONS}
    )
    if role.permissions != settings.SENTRY_USER_PERMISSIONS:
        role.permissions = settings.SENTRY_USER_PERMISSIONS
        role.save(update_fields=["permissions"])


post_upgrade.connect(
    manage_default_super_admin_role,
    dispatch_uid="manage_default_super_admin_role",
    weak=False,
    sender=SiloMode.MONOLITH,
)
