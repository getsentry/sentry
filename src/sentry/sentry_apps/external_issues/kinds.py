from enum import StrEnum

from sentry.integrations.models.external_issue import ExternalIssue
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue


class ExternalIssueKind(StrEnum):
    """Which of the two unrelated external-issue models an event is about."""

    INTEGRATION = "integration"
    PLATFORM = "platform"

    @classmethod
    def of(cls, external_issue: ExternalIssue | PlatformExternalIssue) -> "ExternalIssueKind":
        return cls.INTEGRATION if isinstance(external_issue, ExternalIssue) else cls.PLATFORM

    def fetch(
        self, external_issue_id: int, *, group: Group
    ) -> ExternalIssue | PlatformExternalIssue:
        """
        Load the external issue linked to `group`, or raise `ObjectDoesNotExist`.

        The two tables have independent primary keys, so an id is only meaningful
        alongside its kind.
        """
        if self is ExternalIssueKind.PLATFORM:
            return PlatformExternalIssue.objects.get(id=external_issue_id, group_id=group.id)

        # `ExternalIssue` has no group FK; the link is a `GroupLink` row.
        return ExternalIssue.objects.get(
            id__in=GroupLink.objects.filter(
                group_id=group.id,
                project_id=group.project_id,
                linked_type=GroupLink.LinkedType.issue,
            ).values_list("linked_id", flat=True),
            id=external_issue_id,
            organization_id=group.project.organization_id,
        )
