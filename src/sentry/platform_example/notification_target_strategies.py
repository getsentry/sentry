import abc

from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.platform_example.notification_target import (
    NotificationSource,
    NotificationTarget,
    NotificationType,
    NotificationUserTarget,
)


# Target Strategies
class NotificationTargetStrategy(abc.ABC):
    @abc.abstractmethod
    def get_targets(self, source: NotificationType) -> list[NotificationTarget]:
        pass


class NotificationOrganizationTargetStrategy(NotificationTargetStrategy):
    organization_id: str

    def get_targets(self, source: NotificationSource) -> list[NotificationTarget]:
        organization = Organization.objects.get(id=self.organization_id)
        org_members = OrganizationMember.objects.filter(organization=organization)
        return [NotificationUserTarget(user_id=member.user_id) for member in org_members]


class NotificationProjectTargetStrategy(NotificationTargetStrategy):
    project_id: str

    def get_targets(self, source: NotificationSource) -> list[NotificationTarget]:
        # project = Project.objects.get(id=self.project_id)
        # find project members
        # Get all users who are members of the project
        # convert users to NotificationUserTarget
        return []
