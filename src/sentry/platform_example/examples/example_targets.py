from sentry.platform_example.notification_provider import NotificationProviderNames
from sentry.platform_example.notification_target import NotificationTarget
from sentry.platform_example.notification_target_strategies import NotificationTargetStrategy
from sentry.platform_example.notification_types import ProviderResourceType
from sentry.users.models.user import User


class UserEmailsOnlyStrategy(NotificationTargetStrategy):
    def get_targets(self) -> list[NotificationTarget]:
        return [
            NotificationTarget(
                resource_type=ProviderResourceType.EMAIL,
                resource_value=user.email,
                provider=NotificationProviderNames.EMAIL,
                additional_data={"respond_to": "help_me@sentry.io"},
            )
            for user in User.objects.filter(email__isnull=False)
        ]
