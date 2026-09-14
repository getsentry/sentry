from enum import StrEnum

from sentry.integrations.models.external_issue import ExternalIssue
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue


class ExternalIssueKind(StrEnum):
    """Which kind of integration manages an external issue."""

    INTEGRATION = "integration"
    CUSTOM_INTEGRATION = "custom_integration"

    @classmethod
    def of(cls, external_issue: ExternalIssue | PlatformExternalIssue) -> "ExternalIssueKind":
        return (
            cls.INTEGRATION if isinstance(external_issue, ExternalIssue) else cls.CUSTOM_INTEGRATION
        )

    def fetch(
        self, *, external_issue_id: int, group: Group
    ) -> ExternalIssue | PlatformExternalIssue:
        """Load an external issue only when it is linked to `group`."""
        if self is ExternalIssueKind.CUSTOM_INTEGRATION:
            return PlatformExternalIssue.objects.get(id=external_issue_id, group_id=group.id)

        return ExternalIssue.objects.get(
            id__in=GroupLink.objects.filter(
                group_id=group.id,
                project_id=group.project_id,
                linked_type=GroupLink.LinkedType.issue,
            ).values_list("linked_id", flat=True),
            id=external_issue_id,
            organization_id=group.project.organization_id,
        )
