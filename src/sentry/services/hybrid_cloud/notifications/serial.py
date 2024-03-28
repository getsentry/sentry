from sentry.models.integrations.external_actor import ExternalActor
from sentry.notifications.types import GroupSubscriptionStatus
from sentry.services.hybrid_cloud.notifications import RpcExternalActor, RpcGroupSubscriptionStatus


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


def serialize_group_subscription_status(
    status: GroupSubscriptionStatus,
) -> RpcGroupSubscriptionStatus:
    return RpcGroupSubscriptionStatus(
        is_disabled=status.is_disabled,
        is_active=status.is_active,
        has_only_inactive_subscriptions=status.has_only_inactive_subscriptions,
    )


def deserialize_group_subscription_status(
    status: RpcGroupSubscriptionStatus,
) -> GroupSubscriptionStatus:
    return GroupSubscriptionStatus(
        is_disabled=status.is_disabled,
        is_active=status.is_active,
        has_only_inactive_subscriptions=status.has_only_inactive_subscriptions,
    )
