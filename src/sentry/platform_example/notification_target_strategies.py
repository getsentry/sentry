import abc
from dataclasses import dataclass

from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.platform_example.notification_provider import NotificationProviderNames
from sentry.platform_example.notification_target import NotificationTarget
from sentry.platform_example.notification_types import ProviderResourceType


# Target Strategies
class NotificationTargetStrategy(abc.ABC):
    @abc.abstractmethod
    def get_targets(self) -> list[NotificationTarget]:
        pass


@dataclass
class NotificationOrganizationTargetStrategy(NotificationTargetStrategy):
    organization_id: int

    def get_targets(self) -> list[NotificationTarget]:
        organization = Organization.objects.get(id=self.organization_id)
        org_members = OrganizationMember.objects.filter(organization=organization)
        return [
            NotificationTarget(
                resource_type=ProviderResourceType.EMAIL,
                resource_value=member.email,
                provider=NotificationProviderNames.EMAIL,
                additional_data={},
            )
            for member in org_members
            if member.user_id is not None and member.email is not None
        ]


class NotificationTeamTargetStrategy(NotificationTargetStrategy):
    pass


class NotificationProjectTargetStrategy(NotificationTargetStrategy):
    project_id: str

    def get_targets(self) -> list[NotificationTarget]:
        # project = Project.objects.get(id=self.project_id)
        # find project members
        # Get all users who are members of the project
        # convert users to NotificationTarget
        return []
