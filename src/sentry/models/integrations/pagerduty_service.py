from __future__ import annotations

from typing import Any, List, Mapping, Optional, TypedDict

from django.db import models, router, transaction
from django.db.models import CASCADE
from django.utils import timezone

from sentry.db.models import BoundedBigIntegerField, FlexibleForeignKey, Model
from sentry.db.models.base import control_silo_only_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@control_silo_only_model
class PagerDutyService(Model):
    __include_in_export__ = False

    organization_integration = FlexibleForeignKey(
        "sentry.OrganizationIntegration", on_delete=CASCADE, db_constraint=False
    )

    organization_id = HybridCloudForeignKey("sentry.Organization", on_delete="cascade")

    # From a region point of view, you really only have per organization scoping.
    integration_id = BoundedBigIntegerField(db_index=False)
    integration_key = models.CharField(max_length=255)
    service_name = models.CharField(max_length=255)
    date_updated = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_pagerdutyservice"

    def save(self, *args: Any, **kwds: Any) -> None:
        with transaction.atomic(router.db_for_write(PagerDutyService)):
            super().save(*args, **kwds)
            self.add_to_org_integration()

    def add_to_org_integration(self):
        from sentry.models import OrganizationIntegration

        try:
            org_integration = (
                OrganizationIntegration.objects.filter(id=self.organization_integration_id)
                .select_for_update()
                .get()
            )
            existing: list[PagerDutyServiceDict] = PagerDutyService.services_in(
                org_integration.config
            )
            org_integration.config["pagerduty_services"] = [
                row for row in existing if row["id"] != self.id
            ] + [self.as_dict()]
            org_integration.save()
        except OrganizationIntegration.DoesNotExist:
            pass

    def as_dict(self) -> PagerDutyServiceDict:
        return dict(
            integration_id=self.integration_id,
            integration_key=self.integration_key,
            service_name=self.service_name,
            id=self.id,
        )

    @staticmethod
    def services_in(config: Mapping[str, Any]) -> List[PagerDutyServiceDict]:
        return config.get("pagerduty_services", [])

    @staticmethod
    def find_service(config: Mapping[str, Any], id: int | str) -> Optional[PagerDutyServiceDict]:
        try:
            return next(
                pds for pds in PagerDutyService.services_in(config) if str(pds["id"]) == str(id)
            )
        except StopIteration:
            return None


class PagerDutyServiceDict(TypedDict):
    integration_id: int
    integration_key: str
    service_name: str
    id: int
