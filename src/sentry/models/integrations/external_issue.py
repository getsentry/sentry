from __future__ import annotations

from typing import TYPE_CHECKING, Any, Sequence

from django.db import models
from django.db.models import QuerySet
from django.utils import timezone

from sentry.db.models import (
    BaseManager,
    FlexibleForeignKey,
    JSONField,
    Model,
    region_silo_only_model,
    sane_repr,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.eventstore.models import Event

if TYPE_CHECKING:
    from sentry.services.hybrid_cloud.integration import RpcIntegration


class ExternalIssueManager(BaseManager):
    def get_for_integration(
        self, integration: RpcIntegration, external_issue_key: str | None = None
    ) -> QuerySet:
        from sentry.services.hybrid_cloud.integration import integration_service

        org_integrations = integration_service.get_organization_integrations(
            integration_id=integration.id
        )

        kwargs = dict(
            integration_id=integration.id,
            organization_id__in=[oi.organization_id for oi in org_integrations],
        )

        if external_issue_key is not None:
            kwargs["key"] = external_issue_key

        return self.filter(**kwargs)

    def get_linked_issues(
        self, event: Event, integration: RpcIntegration
    ) -> QuerySet[ExternalIssue]:
        from sentry.models import GroupLink

        return self.filter(
            id__in=GroupLink.objects.filter(
                project_id=event.group.project_id,
                group_id=event.group.id,
                linked_type=GroupLink.LinkedType.issue,
            ).values_list("linked_id", flat=True),
            integration_id=integration.id,
        )

    def get_linked_issue_ids(self, event: Event, integration: RpcIntegration) -> Sequence[str]:
        return self.get_linked_issues(event, integration).values_list("key", flat=True)

    def has_linked_issue(self, event: Event, integration: RpcIntegration) -> bool:
        return self.get_linked_issues(event, integration).exists()


@region_silo_only_model
class ExternalIssue(Model):
    __include_in_export__ = False

    # The foreign key here is an `int`, not `bigint`.
    organization = FlexibleForeignKey("sentry.Organization", db_constraint=False)

    integration_id = HybridCloudForeignKey("sentry.Integration", on_delete="CASCADE")

    key = models.CharField(max_length=256)  # example APP-123 in jira
    date_added = models.DateTimeField(default=timezone.now)
    title = models.TextField(null=True)
    description = models.TextField(null=True)
    metadata = JSONField(null=True)

    objects = ExternalIssueManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_externalissue"
        unique_together = (("organization", "integration_id", "key"),)

    __repr__ = sane_repr("organization_id", "integration_id", "key")

    def get_installation(self) -> Any:
        from sentry.services.hybrid_cloud.integration import integration_service

        integration = integration_service.get_integration(integration_id=self.integration_id)

        return integration_service.get_installation(
            integration=integration, organization_id=self.organization_id
        )
