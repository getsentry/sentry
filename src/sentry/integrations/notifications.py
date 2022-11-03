from __future__ import annotations

from collections import defaultdict
from typing import Any, Iterable, Mapping, MutableMapping

from django.db.models import F

from sentry.constants import ObjectStatus
from sentry.models import ExternalActor, Identity, Integration, Organization, Team, User
from sentry.notifications.notifications.base import BaseNotification
from sentry.services.hybrid_cloud.user import APIUser
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders


def get_context(
    notification: BaseNotification,
    recipient: Team | APIUser,
    shared_context: Mapping[str, Any],
    extra_context: Mapping[str, Any],
) -> Mapping[str, Any]:
    """Compose the various levels of context and add Slack-specific fields."""
    return {
        **shared_context,
        **notification.get_recipient_context(recipient, extra_context),
    }


def get_channel_and_integration_by_user(
    user: APIUser,
    organization: Organization,
    provider: ExternalProviders,
) -> Mapping[str, Integration]:

    identities = (
        Identity.objects.filter(
            idp__type=EXTERNAL_PROVIDERS[provider],
            user=user.id,
        )
        # For Microsoft Teams integration, initially we create rows in the
        # identity table with the external_id as a team_id instead of the user_id.
        # We need to exclude rows where this is NOT updated to the user_id later.
        .exclude(external_id=F("idp__external_id")).select_related("idp")
    )

    if not identities:
        # The user may not have linked their identity so just move on
        # since there are likely other users or teams in the list of
        # recipients.
        return {}

    integrations = Integration.objects.get_active_integrations(organization.id).filter(
        provider=EXTERNAL_PROVIDERS[provider],
        external_id__in=[identity.idp.external_id for identity in identities],
    )

    channels_to_integration = {}
    for identity in identities:
        for integration in integrations:
            if identity.idp.external_id == integration.external_id:
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
    organization: Organization, recipients: Iterable[Team | APIUser], provider: ExternalProviders
) -> MutableMapping[Team | APIUser, Mapping[str, Integration]]:
    output: MutableMapping[Team | User, Mapping[str, Integration]] = defaultdict(dict)
    for recipient in recipients:
        channels_to_integrations = (
            get_channel_and_integration_by_user(recipient, organization, provider)
            if recipient.class_name() == "User"
            else get_channel_and_integration_by_team(recipient, organization, provider)
        )
        output[recipient] = channels_to_integrations
    return output
