from sentry.constants import ObjectStatus
from sentry.identity.services.identity import RpcIdentity, identity_service
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.services.integration.service import integration_service
from sentry.integrations.types import (
    ExternalProviderEnum,
    ExternalProviders,
)
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
    Note: For simplicity, we ignore SLACK_STAGING and MSTEAMS since they are not available in prod.
    """
    return [
        *_get_email_targets(participant_map, organization_id=organization_id),
        *_get_slack_targets(participant_map, organization_id=organization_id),
    ]


def _get_email_targets(
    participant_map: ParticipantMap, organization_id: int
) -> list[NotificationTarget]:
    user_ids: set[int] = set()
    team_ids: set[int] = set()
    for actor, _reason in participant_map.get_participants_by_provider(ExternalProviders.EMAIL):
        if actor.actor_type == ActorType.TEAM:
            team_ids.add(actor.id)
        else:
            user_ids.add(actor.id)

    if team_ids:
        members = OrganizationMemberTeam.objects.filter(
            team_id__in=team_ids, team__organization_id=organization_id
        ).select_related("organizationmember")
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
                specific_data={"user_id": user.id},
            )
        )
    return targets


def _get_slack_targets(
    participant_map: ParticipantMap, *, organization_id: int
) -> list[NotificationTarget]:
    user_ids: set[int] = set()
    team_ids: set[int] = set()
    for actor, _reason in participant_map.get_participants_by_provider(ExternalProviders.SLACK):
        if actor.actor_type == ActorType.TEAM:
            team_ids.add(actor.id)
        else:
            user_ids.add(actor.id)

    if not user_ids and not team_ids:
        return []

    return [
        *_get_slack_user_targets(user_ids=user_ids, organization_id=organization_id),
        *_get_slack_team_targets(team_ids=team_ids, organization_id=organization_id),
    ]


def _get_slack_user_targets(
    *,
    user_ids: set[int],
    organization_id: int,
) -> list[NotificationTarget]:
    """
    Checks the Identities available to a user, gets the IdentityProvider of those identities, and ensures
    an Integration exists with IdentityProvider.external_id == Integration.external_id.

    Note: This helper is extremely inefficient because of the limited RPC functions we have available on the
    IdentityService and IntegrationService. This leads to N+1 calls, and lots of mappings. The proper fix
    would be to implement a new RPC method or parameters to better fit this usecase, but I don't have time at the moment.
    """
    if not user_ids:
        return []

    identities: list[RpcIdentity] = []
    for user_id in user_ids:
        user_identities = identity_service.get_user_identities_by_provider_type(
            user_id=user_id,
            provider_type=ExternalProviderEnum.SLACK.value,
            exclude_matching_external_ids=True,
        )
        if user_identities:
            identities.extend(user_identities)

    if not identities:
        return []

    identity_to_external_id: dict[int, str] = {}
    for identity in identities:
        idp = identity_service.get_provider(provider_id=identity.idp_id)
        if not idp:
            continue
        if not idp.external_id:
            continue
        identity_to_external_id[identity.id] = idp.external_id

    all_integrations = integration_service.get_integrations(
        organization_id=organization_id,
        status=ObjectStatus.ACTIVE,
        org_integration_status=ObjectStatus.ACTIVE,
        limit=None,
        providers=[ExternalProviderEnum.SLACK.value],
    )
    external_id_to_integration_id = {
        integration.external_id: integration.id for integration in all_integrations
    }

    targets: list[NotificationTarget] = []
    for identity in identities:
        external_id = identity_to_external_id.get(identity.id)
        if not external_id:
            continue
        integration_id = external_id_to_integration_id.get(external_id)
        if not integration_id:
            continue
        targets.append(
            IntegrationNotificationTarget(
                provider_key=NotificationProviderKey.SLACK,
                resource_type=NotificationTargetResourceType.DIRECT_MESSAGE,
                resource_id=identity.external_id,
                integration_id=integration_id,
                organization_id=organization_id,
                specific_data={"user_id": identity.user_id},
            )
        )
    return targets


def _get_slack_team_targets(
    *,
    team_ids: set[int],
    organization_id: int,
) -> list[NotificationTarget]:
    if not team_ids:
        return []

    org_integrations = integration_service.get_organization_integrations(
        status=ObjectStatus.ACTIVE,
        organization_id=organization_id,
        providers=[ExternalProviderEnum.SLACK.value],
    )

    external_actors = ExternalActor.objects.filter(
        provider=ExternalProviders.SLACK.value,
        team_id__in=team_ids,
        organization_id=organization_id,
        integration_id__in={oi.integration_id for oi in org_integrations},
    ).exclude(external_id__isnull=True)

    targets: list[NotificationTarget] = []
    for external_actor in external_actors:
        targets.append(
            IntegrationNotificationTarget(
                provider_key=NotificationProviderKey.SLACK,
                resource_type=NotificationTargetResourceType.CHANNEL,
                resource_id=external_actor.external_id,
                integration_id=external_actor.integration_id,
                organization_id=organization_id,
                specific_data={"team_id": external_actor.team_id},
            )
        )
    return targets
