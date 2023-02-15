from __future__ import annotations

from collections import defaultdict
from typing import Any, Iterable, Mapping, MutableMapping

from sentry.constants import ObjectStatus
from sentry.models import ExternalActor, Integration, Organization, Team, User
from sentry.notifications.notifications.base import BaseNotification
from sentry.services.hybrid_cloud.identity import RpcIdentity, RpcIdentityProvider, identity_service
from sentry.services.hybrid_cloud.integration import RpcIntegration, integration_service
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders


def get_context(
    notification: BaseNotification,
    recipient: Team | RpcUser,
    shared_context: Mapping[str, Any],
    extra_context: Mapping[str, Any],
) -> Mapping[str, Any]:
    """Compose the various levels of context and add Slack-specific fields."""
    return {
        **shared_context,
        **notification.get_recipient_context(recipient, extra_context),
    }


def get_channel_and_integration_by_user(
    user: User,
    organization: Organization,
    provider: ExternalProviders,
) -> Mapping[str, RpcIntegration]:

    identities = identity_service.get_user_identities_by_provider_type(
        user_id=user.id,
        provider_type=EXTERNAL_PROVIDERS[provider],
        exclude_matching_external_ids=True,
    )

    if not identities:
        # The user may not have linked their identity so just move on
        # since there are likely other users or teams in the list of
        # recipients.
        return {}

    identity_id_to_idp: Mapping[RpcIdentity.id, RpcIdentityProvider | None] = {
        identity.id: identity_service.get_provider(provider_id=identity.idp_id)
        for identity in identities
    }

    all_integrations = integration_service.get_integrations(
        organization_id=organization.id,
        status=ObjectStatus.ACTIVE,
        org_integration_status=ObjectStatus.ACTIVE,
        limit=None,
        providers=[EXTERNAL_PROVIDERS[provider]],
    )
    all_external_ids = [identity_id_to_idp[identity.id].external_id for identity in identities]

    integrations = [i for i in all_integrations if i.external_id in all_external_ids]

    channels_to_integration = {}
    for identity in identities:
        for integration in integrations:
            idp = identity_id_to_idp[identity.id]
            if idp and idp.external_id == integration.external_id:
                channels_to_integration[identity.external_id] = integration
                break

    return channels_to_integration


def get_channel_and_integration_by_team(
    team: Team, organization: Organization, provider: ExternalProviders
) -> Mapping[str, Integration]:
    try:
        external_actor = (
            ExternalActor.objects.filter(
                provider=provider.value,
                actor_id=team.actor_id,
                organization=organization,
                integration__status=ObjectStatus.ACTIVE,
                integration__organizationintegration__status=ObjectStatus.ACTIVE,
                # limit to org here to prevent multiple query results
                integration__organizationintegration__organization=organization,
            )
            .select_related("integration")
            .get()
        )
    except ExternalActor.DoesNotExist:
        return {}
    return {external_actor.external_id: external_actor.integration}


def get_integrations_by_channel_by_recipient(
    organization: Organization, recipients: Iterable[Team | User], provider: ExternalProviders
) -> MutableMapping[Team | User, Mapping[str, RpcIntegration | Integration]]:
    output: MutableMapping[Team | User, Mapping[str, RpcIntegration | Integration]] = defaultdict(
        dict
    )
    for recipient in recipients:
        channels_to_integrations = (
            get_channel_and_integration_by_user(recipient, organization, provider)
            if recipient.class_name() == "User"
            else get_channel_and_integration_by_team(recipient, organization, provider)
        )
        output[recipient] = channels_to_integrations
    return output
