from sentry.platform_example.notification_target import NotificationTarget, NotificationUserTarget
from sentry.platform_example.notification_target_strategies import NotificationTargetStrategy
from sentry.users.models.user import User


class UserEmailsOnlyStrategy(NotificationTargetStrategy):
    def get_targets(self) -> list[NotificationTarget]:
        return [
            NotificationUserTarget(user_id=user.id)
            for user in User.objects.filter(email__isnull=False)
        ]
