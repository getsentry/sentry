from __future__ import annotations

from typing import TYPE_CHECKING, Any, Sequence

from django.db import models
from django.db.models import QuerySet
from django.utils import timezone

from sentry.db.models import BaseManager, FlexibleForeignKey, JSONField, Model, sane_repr
from sentry.eventstore.models import Event

if TYPE_CHECKING:
    from sentry.models import Integration


class ExternalIssueManager(BaseManager):
    def get_for_integration(
        self, integration: Integration, external_issue_key: str | None = None
    ) -> QuerySet:
        kwargs = dict(
            integration=integration,
            organization__organizationintegration__integration=integration,
        )

        if external_issue_key is not None:
            kwargs["key"] = external_issue_key

        return self.filter(**kwargs)

    def get_linked_issues(self, event: Event, integration: Integration) -> QuerySet[ExternalIssue]:
        from sentry.models import GroupLink

        return self.filter(
            id__in=GroupLink.objects.filter(
                project_id=event.group.project_id,
                group_id=event.group.id,
                linked_type=GroupLink.LinkedType.issue,
            ).values_list("linked_id", flat=True),
            integration_id=integration.id,
        )

    def get_linked_issue_ids(self, event: Event, integration: Integration) -> Sequence[str]:
        return self.get_linked_issues(event, integration).values_list("key", flat=True)

    def has_linked_issue(self, event: Event, integration: Integration) -> bool:
        return self.get_linked_issues(event, integration).exists()


class ExternalIssue(Model):
    __include_in_export__ = False

    # The foreign key here is an `int`, not `bigint`.
    organization = FlexibleForeignKey("sentry.Organization", db_constraint=False)

    # The foreign key here is an `int`, not `bigint`.
    integration = FlexibleForeignKey("sentry.Integration", db_constraint=False)

    key = models.CharField(max_length=128)  # example APP-123 in jira
    date_added = models.DateTimeField(default=timezone.now)
    title = models.TextField(null=True)
    description = models.TextField(null=True)
    metadata = JSONField(null=True)

    objects = ExternalIssueManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_externalissue"
        unique_together = (("organization", "integration", "key"),)

    __repr__ = sane_repr("organization_id", "integration_id", "key")

    def get_installation(self) -> Any:
        from sentry.models import Integration

        return Integration.objects.get(id=self.integration_id).get_installation(
            organization_id=self.organization_id
        )
