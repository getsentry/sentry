from __future__ import annotations

from typing import TYPE_CHECKING, Any, ClassVar, Mapping

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.constants import ObjectStatus
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    control_silo_only_model,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.fields.jsonfield import JSONField
from sentry.db.models.outboxes import ControlOutboxProducingManager, ReplicatedControlModel
from sentry.models.outbox import OutboxCategory

if TYPE_CHECKING:
    from sentry.integrations.pagerduty.utils import PagerDutyServiceDict


@control_silo_only_model
class OrganizationIntegration(ReplicatedControlModel):
    __relocation_scope__ = RelocationScope.Global
    category = OutboxCategory.ORGANIZATION_INTEGRATION_UPDATE
    default_flush = False

    date_updated = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now, null=True)

    organization_id = HybridCloudForeignKey("sentry.Organization", on_delete="CASCADE")
    integration = FlexibleForeignKey("sentry.Integration")
    config = JSONField(default=dict)

    default_auth_id = BoundedPositiveIntegerField(db_index=True, null=True)
    status = BoundedPositiveIntegerField(
        default=ObjectStatus.ACTIVE, choices=ObjectStatus.as_choices()
    )
    # After the grace period, we will mark the status as disabled.
    grace_period_end = models.DateTimeField(null=True, blank=True, db_index=True)

    objects: ClassVar[
        ControlOutboxProducingManager[OrganizationIntegration]
    ] = ControlOutboxProducingManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationintegration"
        unique_together = (("organization_id", "integration"),)

    def handle_async_replication(self, region_name: str, shard_identifier: int) -> None:
        pass

    @classmethod
    def handle_async_deletion(
        cls,
        identifier: int,
        region_name: str,
        shard_identifier: int,
        payload: Mapping[str, Any] | None,
    ) -> None:
        pass

    def add_pagerduty_service(
        self, integration_key: str, service_name: str
    ) -> PagerDutyServiceDict:
        # TODO(mark) remove this shim code once getsentry is updated.
        from sentry.integrations.pagerduty.utils import add_service

        return add_service(self, integration_key=integration_key, service_name=service_name)

    @classmethod
    def services_in(cls, config: dict[str, Any]) -> list[PagerDutyServiceDict]:
        # TODO(mark) remove this shim code once getsentry is updated.
        if not config:
            return []
        return config.get("pagerduty_services", [])
