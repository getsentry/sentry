from __future__ import annotations

from typing import Any, List, Mapping, TypedDict

from django.db import models, router, transaction
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


@control_silo_only_model
class OrganizationIntegration(ReplicatedControlModel):
    __relocation_scope__ = RelocationScope.Global
    category = OutboxCategory.ORGANIZATION_INTEGRATION_UPDATE
    default_flush = False

    date_updated = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now, null=True)

    organization_id = HybridCloudForeignKey("sentry.Organization", on_delete="cascade")
    integration = FlexibleForeignKey("sentry.Integration")
    config = JSONField(default=dict)

    default_auth_id = BoundedPositiveIntegerField(db_index=True, null=True)
    status = BoundedPositiveIntegerField(
        default=ObjectStatus.ACTIVE, choices=ObjectStatus.as_choices()
    )
    # After the grace period, we will mark the status as disabled.
    grace_period_end = models.DateTimeField(null=True, blank=True, db_index=True)

    objects = ControlOutboxProducingManager["OrganizationIntegration"]()

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

    @staticmethod
    def services_in(config: Mapping[str, Any]) -> List[PagerDutyServiceDict]:
        return config.get("pagerduty_services", [])

    def set_services(self, services: List[PagerDutyServiceDict]) -> None:
        self.config["pagerduty_services"] = services

    @staticmethod
    def find_service(config: Mapping[str, Any], id: int | str) -> PagerDutyServiceDict | None:
        try:
            return next(
                pds
                for pds in OrganizationIntegration.services_in(config)
                if str(pds["id"]) == str(id)
            )
        except StopIteration:
            return None

    def add_pagerduty_service(
        self, integration_key: str, service_name: str
    ) -> PagerDutyServiceDict:
        with transaction.atomic(router.db_for_write(OrganizationIntegration)):
            OrganizationIntegration.objects.filter(id=self.id).select_for_update()

            with transaction.get_connection(
                router.db_for_write(OrganizationIntegration)
            ).cursor() as cursor:
                cursor.execute(
                    "SELECT nextval(%s)", [f"{OrganizationIntegration._meta.db_table}_id_seq"]
                )
                next_id: int = cursor.fetchone()[0]

            service: PagerDutyServiceDict = {
                "id": next_id,
                "integration_key": integration_key,
                "service_name": service_name,
                "integration_id": self.integration_id,
            }

            existing: list[PagerDutyServiceDict] = OrganizationIntegration.services_in(self.config)
            new_services: list[PagerDutyServiceDict] = existing + [service]
            self.config["pagerduty_services"] = new_services
            self.save()
        return service


class PagerDutyServiceDict(TypedDict):
    integration_id: int
    integration_key: str
    service_name: str
    id: int
