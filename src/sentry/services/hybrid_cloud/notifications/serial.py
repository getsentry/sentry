from sentry.models.integrations.external_actor import ExternalActor
from sentry.models.notificationsetting import NotificationSetting
from sentry.services.hybrid_cloud.notifications import RpcExternalActor, RpcNotificationSetting


def serialize_notification_setting(setting: NotificationSetting) -> RpcNotificationSetting:
    return RpcNotificationSetting(
        id=setting.id,
        scope_type=setting.scope_type,
        scope_identifier=setting.scope_identifier,
        target_id=setting.target_id,
        team_id=setting.team_id,
        user_id=setting.user_id,
        provider=setting.provider,
        type=setting.type,
        value=setting.value,
    )


def serialize_external_actor(actor: ExternalActor) -> RpcExternalActor:
    return RpcExternalActor(
        id=actor.id,
        team_id=actor.team_id,
        user_id=actor.user_id,
        organization_id=actor.organization_id,
        integration_id=actor.integration_id,
        provider=actor.provider,
        external_name=actor.external_name,
        external_id=actor.external_id,
    )
