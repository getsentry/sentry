from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from django.db import models

from sentry.db.models import FlexibleForeignKey, cell_silo_model
from sentry.db.models.fields.bounded import BoundedBigIntegerField
from sentry.hybridcloud.outbox.base import ReplicatedCellModel
from sentry.hybridcloud.outbox.category import OutboxCategory

from . import AvatarBase


@cell_silo_model
class OrganizationAvatar(AvatarBase, ReplicatedCellModel):
    """
    An OrganizationAvatar associates an Organization with their avatar photo File
    and contains their preferences for avatar type.
    """

    category = OutboxCategory.ORGANIZATION_AVATAR_UPDATE

    AVATAR_TYPES = ((0, "letter_avatar"), (1, "upload"))

    FILE_TYPE = "avatar.file"

    file_id = BoundedBigIntegerField(unique=True, null=True)

    organization = FlexibleForeignKey("sentry.Organization", unique=True, related_name="avatar")
    avatar_type = models.PositiveSmallIntegerField(default=0, choices=AVATAR_TYPES)

    url_path = "organization-avatar"

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationavatar"

    def get_cache_key(self, size) -> str:
        return f"org_avatar:{self.organization_id}:{size}"

    def handle_async_replication(self, shard_identifier: int) -> None:
        from sentry.hybridcloud.services.replica import control_replica_service

        control_replica_service.upsert_organization_avatar_replica(
            organization_id=self.organization_id,
            avatar_type=self.avatar_type,
            avatar_ident=self.ident,
        )

    @classmethod
    def handle_async_deletion(
        cls, identifier: int, shard_identifier: int, payload: Mapping[str, Any] | None
    ) -> None:
        from sentry.hybridcloud.services.replica import control_replica_service

        control_replica_service.delete_organization_avatar_replica(
            organization_id=shard_identifier,
        )
