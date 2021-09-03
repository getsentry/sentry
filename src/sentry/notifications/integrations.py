from typing import Any, Mapping, Union

from sentry.models import ExternalActor, Identity, Integration, Organization, Team, User
from sentry.notifications.notifications.activity.base import ActivityNotification
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.notifications.rules import AlertRuleNotification
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders


def get_context(
    notification: BaseNotification,
    recipient: Union[User, Team],
    shared_context: Mapping[str, Any],
    extra_context: Mapping[str, Any],
) -> Mapping[str, Any]:
    """Compose the various levels of context and add Slack-specific fields."""
    return {
        **shared_context,
        **notification.get_user_context(recipient, extra_context),
    }


def get_key(notification: BaseNotification) -> str:
    if isinstance(notification, ActivityNotification):
        return "activity"
    elif isinstance(notification, AlertRuleNotification):
        return "issue_alert"
    else:
        return ""


def get_channel_and_integration_by_user(
    user: User, organization: Organization, provider: ExternalProviders
) -> Mapping[str, Integration]:
    identities = Identity.objects.filter(
        idp__type=EXTERNAL_PROVIDERS[provider],
        user=user.id,
    ).select_related("idp")

    if not identities:
        # The user may not have linked their identity so just move on
        # since there are likely other users or teams in the list of
        # recipients.
        return {}

    integrations = Integration.objects.filter(
        provider=EXTERNAL_PROVIDERS[provider],
        organizations=organization,
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
            )
            .select_related("integration")
            .get()
        )
    except ExternalActor.DoesNotExist:
        return {}

    return {external_actor.external_id: external_actor.integration}
