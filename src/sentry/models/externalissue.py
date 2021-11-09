from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.db import models
from django.db.models import QuerySet
from django.utils import timezone

from sentry.db.models import BaseManager, BoundedPositiveIntegerField, JSONField, Model, sane_repr

if TYPE_CHECKING:
    from sentry.models import Integration


class ExternalIssueManager(BaseManager):
    def get_for_integration(
        self, integration: Integration, external_issue_key: str | None = None
    ) -> QuerySet:
        """TODO(mgaeta): Migrate the model to use FlexibleForeignKey."""
        kwargs = dict(
            integration_id=integration.id,
            organization_id__in={_.id for _ in integration.organizations.all()},
        )

        if external_issue_key is not None:
            kwargs["key"] = external_issue_key

        return self.filter(**kwargs)


class ExternalIssue(Model):
    __include_in_export__ = False

    organization_id = BoundedPositiveIntegerField()
    integration_id = BoundedPositiveIntegerField()
    key = models.CharField(max_length=128)  # example APP-123 in jira
    date_added = models.DateTimeField(default=timezone.now)
    title = models.TextField(null=True)
    description = models.TextField(null=True)
    metadata = JSONField(null=True)

    objects = ExternalIssueManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_externalissue"
        unique_together = (("organization_id", "integration_id", "key"),)

    __repr__ = sane_repr("organization_id", "integration_id", "key")

    def get_installation(self) -> Any:
        from sentry.models import Integration

        return Integration.objects.get(id=self.integration_id).get_installation(
            organization_id=self.organization_id
        )
