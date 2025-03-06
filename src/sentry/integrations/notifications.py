from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable, Mapping, MutableMapping
from typing import Any

from sentry.constants import ObjectStatus
from sentry.identity.services.identity import identity_service
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.integrations.types import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.models.organization import Organization
from sentry.models.team import Team
from sentry.notifications.notifications.base import BaseNotification
from sentry.types.actor import Actor
from sentry.users.services.user import RpcUser


def get_context(
    notification: BaseNotification,
    recipient: Actor | Team | RpcUser,
    shared_context: Mapping[str, Any],
    extra_context: Mapping[str, Any],
) -> Mapping[str, Any]:
    """Compose the various levels of context and add Slack-specific fields."""
    return {
        **shared_context,
        **notification.get_recipient_context(Actor.from_object(recipient), extra_context),
    }


def _get_channel_and_integration_by_user(
    user_id: int,
    organization: Organization,
    provider: ExternalProviders,
) -> Mapping[str, RpcIntegration]:

    identities = identity_service.get_user_identities_by_provider_type(
        user_id=user_id,
        provider_type=EXTERNAL_PROVIDERS[provider],
        exclude_matching_external_ids=True,
    )

    if not identities:
        # The user may not have linked their identity so just move on
        # since there are likely other users or teams in the list of
        # recipients.
        return {}

    identity_id_to_idp = {}
    for identity in identities:
        idp = identity_service.get_provider(provider_id=identity.idp_id)
        if idp is not None:
            identity_id_to_idp[identity.id] = idp

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


def _get_channel_and_integration_by_team(
    team_id: int, organization: Organization, provider: ExternalProviders
) -> dict[str, RpcIntegration]:
    org_integrations = integration_service.get_organization_integrations(
        status=ObjectStatus.ACTIVE, organization_id=organization.id
    )

    try:
        external_actor = ExternalActor.objects.get(
            provider=provider.value,
            team_id=team_id,
            organization_id=organization.id,
            integration_id__in=[oi.integration_id for oi in org_integrations],
        )
    except ExternalActor.DoesNotExist:
        return {}

    integration = integration_service.get_integration(
        integration_id=external_actor.integration_id, status=ObjectStatus.ACTIVE
    )
    if integration is None or external_actor.external_id is None:
        return {}
    return {external_actor.external_id: integration}


def get_integrations_by_channel_by_recipient(
    organization: Organization,
    recipients: Iterable[Actor],
    provider: ExternalProviders,
) -> Mapping[Actor, Mapping[str, RpcIntegration]]:
    output: MutableMapping[Actor, Mapping[str, RpcIntegration]] = defaultdict(dict)
    for recipient in Actor.many_from_object(recipients):
        channels_to_integrations = None
        if recipient.is_user:
            channels_to_integrations = _get_channel_and_integration_by_user(
                recipient.id, organization, provider
            )
        elif recipient.is_team:
            channels_to_integrations = _get_channel_and_integration_by_team(
                recipient.id, organization, provider
            )
        if channels_to_integrations is not None:
            output[recipient] = channels_to_integrations
    return output
