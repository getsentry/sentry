from sentry.models.integrations.external_actor import ExternalActor
from sentry.services.hybrid_cloud.notifications import RpcExternalActor


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
