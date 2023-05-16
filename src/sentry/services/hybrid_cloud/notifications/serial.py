from sentry.models import NotificationSetting
from sentry.services.hybrid_cloud.notifications import RpcNotificationSetting


def serialize_notification_setting(setting: NotificationSetting) -> RpcNotificationSetting:
    return RpcNotificationSetting(
        scope_type=setting.scope_type,
        scope_identifier=setting.scope_identifier,
        target_id=setting.target_id,
        team_id=setting.team_id,
        user_id=setting.user_id,
        provider=setting.provider,
        type=setting.type,
        value=setting.value,
    )
