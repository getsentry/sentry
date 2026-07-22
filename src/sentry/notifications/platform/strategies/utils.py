from sentry.identity.services.identity import identity_service
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.services.integration.service import integration_service
from sentry.integrations.types import ExternalProviders
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.notifications.platform.target import (
    GenericNotificationTarget,
    IntegrationNotificationTarget,
)
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTarget,
    NotificationTargetResourceType,
)
from sentry.notifications.utils.participants import ParticipantMap
from sentry.types.actor import ActorType
from sentry.users.services.user.service import user_service


def get_targets_from_participant_map(
    participant_map: ParticipantMap, *, organization_id: int
) -> list[NotificationTarget]:
    """
    Converts legacy ParticipantMap types to the platform's new NotificationTarget list.
    """
    return [
        *_get_email_targets(participant_map),
        *_get_slack_targets(participant_map, organization_id=organization_id),
    ]


def _get_email_targets(participant_map: ParticipantMap) -> list[NotificationTarget]:
    user_ids: set[int] = set()
    team_ids: set[int] = set()
    for actor, _reason in participant_map.get_participants_by_provider(ExternalProviders.EMAIL):
        if actor.actor_type == ActorType.TEAM:
            team_ids.add(actor.id)
        else:
            user_ids.add(actor.id)

    if team_ids:
        members = OrganizationMemberTeam.objects.filter(team_id__in=team_ids).select_related(
            "organizationmember"
        )
        for member in members:
            uid = member.organizationmember.user_id
            if uid is not None:
                user_ids.add(uid)

    if not user_ids:
        return []

    users = user_service.get_many_by_id(ids=list(user_ids))
    targets: list[NotificationTarget] = []
    for user in users:
        if not user.email:
            continue
        targets.append(
            GenericNotificationTarget(
                provider_key=NotificationProviderKey.EMAIL,
                resource_type=NotificationTargetResourceType.EMAIL,
                resource_id=user.email,
            )
        )
    return targets


def _get_slack_targets(
    participant_map: ParticipantMap, *, organization_id: int
) -> list[NotificationTarget]:
    slack_user_ids: set[int] = set()
    slack_team_ids: set[int] = set()
    for actor, _reason in participant_map.get_participants_by_provider(ExternalProviders.SLACK):
        if actor.actor_type == ActorType.TEAM:
            slack_team_ids.add(actor.id)
        else:
            slack_user_ids.add(actor.id)

    if not slack_user_ids and not slack_team_ids:
        return []

    org_integrations = integration_service.get_organization_integrations(
        organization_id=organization_id,
        providers=["slack"],
        limit=1,
    )
    if not org_integrations:
        return []

    org_integration = org_integrations[0]
    integration = integration_service.get_integration(integration_id=org_integration.integration_id)
    if integration is None or integration.external_id is None:
        return []

    targets: list[NotificationTarget] = []
    targets.extend(
        _get_slack_user_targets(
            user_ids=slack_user_ids,
            integration_provider=integration.provider,
            integration_external_id=integration.external_id,
            integration_id=org_integration.integration_id,
            organization_id=organization_id,
        )
    )
    targets.extend(
        _get_slack_team_targets(
            team_ids=slack_team_ids,
            integration_id=org_integration.integration_id,
            organization_id=organization_id,
        )
    )
    return targets


def _get_slack_user_targets(
    *,
    user_ids: set[int],
    integration_provider: str,
    integration_external_id: str,
    integration_id: int,
    organization_id: int,
) -> list[NotificationTarget]:
    if not user_ids:
        return []

    idp = identity_service.get_provider(
        provider_type=integration_provider,
        provider_ext_id=integration_external_id,
    )
    if idp is None:
        return []

    targets: list[NotificationTarget] = []
    for user_id in user_ids:
        identity = identity_service.get_identity(filter={"user_id": user_id, "provider_id": idp.id})
        if identity is None:
            continue
        targets.append(
            IntegrationNotificationTarget(
                provider_key=NotificationProviderKey.SLACK,
                resource_type=NotificationTargetResourceType.DIRECT_MESSAGE,
                resource_id=identity.external_id,
                integration_id=integration_id,
                organization_id=organization_id,
            )
        )
    return targets


def _get_slack_team_targets(
    *,
    team_ids: set[int],
    integration_id: int,
    organization_id: int,
) -> list[NotificationTarget]:
    if not team_ids:
        return []

    external_actors = ExternalActor.objects.filter(
        provider=ExternalProviders.SLACK.value,
        team_id__in=team_ids,
        organization_id=organization_id,
        integration_id=integration_id,
    ).exclude(external_id__isnull=True)

    targets: list[NotificationTarget] = []
    for external_actor in external_actors:
        targets.append(
            IntegrationNotificationTarget(
                provider_key=NotificationProviderKey.SLACK,
                resource_type=NotificationTargetResourceType.CHANNEL,
                resource_id=external_actor.external_id,
                integration_id=integration_id,
                organization_id=organization_id,
            )
        )
    return targets
