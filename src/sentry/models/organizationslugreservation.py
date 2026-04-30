from __future__ import annotations

from collections.abc import Collection, Mapping
from enum import IntEnum
from typing import Any

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models.base import control_silo_model, sane_repr
from sentry.db.models.fields import BoundedBigIntegerField
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.hybridcloud.outbox.base import ReplicatedControlModel
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.hybridcloud.rpc import CELL_NAME_LENGTH


class OrganizationSlugReservationType(IntEnum):
    PRIMARY = 0
    VANITY_ALIAS = 1
    TEMPORARY_RENAME_ALIAS = 2

    @classmethod
    def as_choices(cls):
        return [(i.value, i.value) for i in cls]


@control_silo_model
class OrganizationSlugReservation(ReplicatedControlModel):
    __relocation_scope__ = RelocationScope.Excluded
    category = OutboxCategory.ORGANIZATION_SLUG_RESERVATION_UPDATE
    replication_version = 1

    slug = models.SlugField(unique=True, null=False)
    organization_id = HybridCloudForeignKey("sentry.organization", null=False, on_delete="CASCADE")
    user_id = BoundedBigIntegerField(db_index=True, null=True)
    cell_name = models.CharField(max_length=CELL_NAME_LENGTH, null=False, db_column="region_name")
    reservation_type = BoundedBigIntegerField(
        choices=OrganizationSlugReservationType.as_choices(),
        null=False,
        default=OrganizationSlugReservationType.PRIMARY.value,
    )
    date_added = models.DateTimeField(null=False, default=timezone.now, editable=False)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationslugreservation"
        unique_together = (("organization_id", "reservation_type"),)

    __repr__ = sane_repr("slug", "organization_id", "reservation_type")

    def save(self, *args: Any, **kwds: Any) -> None:
        assert kwds.get("unsafe_write", None), (
            "Cannot write changes to OrganizationSlugReservation unless they go through a provisioning flow"
        )

        kwds.pop("unsafe_write")
        return super().save(*args, **kwds)

    def update(self, *args: Any, **kwds: Any):
        assert kwds.get("unsafe_write", None), (
            "Cannot write changes to OrganizationSlugReservation unless they go through a provisioning flow"
        )

        kwds.pop("unsafe_write")
        return super().update(*args, **kwds)

    def outbox_cell_names(self) -> Collection[str]:
        return [self.cell_name]

    def handle_async_replication(self, cell_name: str, shard_identifier: int) -> None:
        from sentry.hybridcloud.services.control_organization_provisioning.serial import (
            serialize_slug_reservation,
        )
        from sentry.hybridcloud.services.replica import cell_replica_service

        serialized = serialize_slug_reservation(self)
        cell_replica_service.upsert_replicated_org_slug_reservation(
            slug_reservation=serialized, cell_name=self.cell_name
        )

    @classmethod
    def handle_async_deletion(
        cls,
        identifier: int,
        cell_name: str,
        shard_identifier: int,
        payload: Mapping[str, Any] | None,
    ) -> None:
        from sentry.hybridcloud.services.replica import cell_replica_service

        cell_replica_service.delete_replicated_org_slug_reservation(
            cell_name=cell_name,
            organization_slug_reservation_id=identifier,
        )
