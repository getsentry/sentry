from __future__ import annotations

from typing import Any, List, Mapping, Optional, TypedDict

from django.db import models, router, transaction

from sentry.constants import ObjectStatus
from sentry.db.models import (
    BoundedPositiveIntegerField,
    DefaultFieldsModel,
    FlexibleForeignKey,
    control_silo_only_model,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.fields.jsonfield import JSONField
from sentry.models.outbox import ControlOutbox, OutboxCategory, OutboxScope, outbox_context
from sentry.types.region import find_regions_for_orgs


@control_silo_only_model
class OrganizationIntegration(DefaultFieldsModel):
    __include_in_export__ = False

    organization_id = HybridCloudForeignKey("sentry.Organization", on_delete="cascade")
    integration = FlexibleForeignKey("sentry.Integration")
    config = JSONField(default=dict)

    default_auth_id = BoundedPositiveIntegerField(db_index=True, null=True)
    status = BoundedPositiveIntegerField(
        default=ObjectStatus.ACTIVE, choices=ObjectStatus.as_choices()
    )
    # After the grace period, we will mark the status as disabled.
    grace_period_end = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationintegration"
        unique_together = (("organization_id", "integration"),)

    def outboxes_for_update(self) -> List[ControlOutbox]:
        return [
            ControlOutbox(
                shard_scope=OutboxScope.ORGANIZATION_SCOPE,
                shard_identifier=self.organization_id,
                object_identifier=self.id,
                category=OutboxCategory.ORGANIZATION_INTEGRATION_UPDATE,
                region_name=region_name,
            )
            for region_name in find_regions_for_orgs([self.organization_id])
        ]

    def delete(self, *args, **kwds):
        with outbox_context(
            transaction.atomic(router.db_for_write(OrganizationIntegration)), flush=False
        ):
            for outbox in self.outboxes_for_update():
                outbox.save()
            super().delete(*args, **kwds)

    @staticmethod
    def add_pagerduty_service(
        org_id: int, service: PagerDutyServiceDict
    ) -> OrganizationIntegration | None:
        try:
            with transaction.atomic(router.db_for_write(OrganizationIntegration)):
                org_integration = (
                    OrganizationIntegration.objects.filter(
                        organization_id=org_id, integration_id=service["integration_id"]
                    )
                    .select_for_update()
                    .get()
                )
                existing: list[PagerDutyServiceDict] = OrganizationIntegration.services_in(
                    org_integration.config
                )
                org_integration.config["pagerduty_services"] = [
                    row for row in existing if row["id"] != service["id"]
                ] + [service]
                org_integration.save()
        except OrganizationIntegration.DoesNotExist:
            return None

    @staticmethod
    def services_in(config: Mapping[str, Any]) -> List[PagerDutyServiceDict]:
        return config.get("pagerduty_services", [])

    @staticmethod
    def find_service(config: Mapping[str, Any], id: int | str) -> Optional[PagerDutyServiceDict]:
        try:
            return next(
                pds
                for pds in OrganizationIntegration.services_in(config)
                if str(pds["id"]) == str(id)
            )
        except StopIteration:
            return None


class PagerDutyServiceDict(TypedDict):
    integration_id: int
    integration_key: str
    service_name: str
    id: int
