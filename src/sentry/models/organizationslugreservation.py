from __future__ import annotations

from enum import IntEnum
from typing import Any

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models.base import control_silo_model, sane_repr
from sentry.db.models.fields import BoundedBigIntegerField
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.hybridcloud.models.outbox import ControlOutboxBase
from sentry.hybridcloud.outbox.base import ControlOutboxProducingModel
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.hybridcloud.rpc import CELL_NAME_LENGTH


class OrganizationSlugReservationType(IntEnum):
    PRIMARY = 0
    VANITY_ALIAS = 1
    TEMPORARY_RENAME_ALIAS = 2

    @classmethod
    def as_choices(cls) -> list[tuple[int, int]]:
        return [(i.value, i.value) for i in cls]


@control_silo_model
class OrganizationSlugReservation(ControlOutboxProducingModel):
    __relocation_scope__ = RelocationScope.Excluded

    # TODO(cells) can this model not flush by default?
    # If flushes can become async that removes more blocking work from provisioning paths.
    category = OutboxCategory.ORGANIZATION_SLUG_RESERVATION_UPDATE

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

    def update(self, *args: Any, **kwds: Any) -> int:
        assert kwds.get("unsafe_write", None), (
            "Cannot write changes to OrganizationSlugReservation unless they go through a provisioning flow"
        )

        kwds.pop("unsafe_write")
        return super().update(*args, **kwds)

    def outboxes_for_update(self, shard_identifier: int | None = None) -> list[ControlOutboxBase]:
        """
        Called by ControlOutboxProducingBase to create an outbox message when this record changes.
        """
        return self.category.as_control_outboxes(
            cell_names=[self.cell_name],
            model=self,
            payload=None,
            shard_identifier=shard_identifier,
        )
