import logging
from typing import AbstractSet, Any, Mapping, Optional, Set, Tuple, Union

from sentry.integrations.slack.client import SlackClient  # NOQA
from sentry.integrations.slack.message_builder.notifications import build_notification_attachment
from sentry.models import ExternalActor, Identity, Integration, Organization, Team, User
from sentry.notifications.activity.base import ActivityNotification
from sentry.notifications.base import BaseNotification
from sentry.notifications.notify import register_notification_provider
from sentry.notifications.rules import AlertRuleNotification
from sentry.shared_integrations.exceptions import ApiError
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.utils import json, metrics

logger = logging.getLogger("sentry.notifications")
SLACK_TIMEOUT = 5


def get_context(
    notification: BaseNotification,
    recipient: Union[User, Team],
    shared_context: Mapping[str, Any],
    extra_context: Mapping[str, Any],
) -> Mapping[str, Any]:
    """ Compose the various levels of context and add slack-specific fields. """
    return {
        **shared_context,
        **notification.get_user_context(recipient, extra_context),
    }


def get_channel_and_integration_by_user(
    user: User, organization: Organization
) -> Tuple[Optional[str], Optional[Integration]]:
    try:
        identity = Identity.objects.get(
            idp__type=EXTERNAL_PROVIDERS[ExternalProviders.SLACK],
            user=user.id,
        )
    except Identity.DoesNotExist:
        # The user may not have linked their identity so just move on
        # since there are likely other users or teams in the list of
        # recipients.
        return None, None

    try:
        integration = Integration.objects.get(
            provider=identity.idp.type,
            organizations=organization,
        )
    except Integration.DoesNotExist:
        return None, None

    return identity.external_id, integration


def get_channel_and_integration_by_team(
    team: Team, organization: Organization
) -> Tuple[Optional[str], Optional[Integration]]:
    try:
        external_actor = (
            ExternalActor.objects.filter(
                provider=ExternalProviders.SLACK.value,
                actor_id=team.actor_id,
                organization=organization,
            )
            .select_related("integration")
            .get()
        )
    except ExternalActor.DoesNotExist:
        return None, None

    return (
        external_actor.external_id,
        external_actor.integration,
    )


def get_channel_and_token_by_recipient(
    organization: Organization, recipients: AbstractSet[Union[User, Team]]
) -> Mapping[Union[User, Team], Tuple[str, str]]:
    output = {}
    for recipient in recipients:
        channel, integration = (
            get_channel_and_integration_by_user(recipient, organization)
            if isinstance(recipient, User)
            else get_channel_and_integration_by_team(recipient, organization)
        )

        try:
            token = integration.metadata["access_token"]
        except AttributeError as e:
            logger.info(
                "notification.fail.invalid_slack",
                extra={
                    "error": str(e),
                    "organization": organization,
                    "recipient": recipient.id,
                },
            )
            continue

        output[recipient] = channel, token
    return output


def get_key(notification: BaseNotification) -> str:
    if isinstance(notification, ActivityNotification):
        return "activity"
    elif isinstance(notification, AlertRuleNotification):
        return "issue_alert"
    else:
        return ""


@register_notification_provider(ExternalProviders.SLACK)
def send_notification_as_slack(
    notification: BaseNotification,
    recipients: Union[Set[User], Set[Team]],
    shared_context: Mapping[str, Any],
    extra_context_by_user_id: Mapping[str, Any],
) -> None:
    """ Send an "activity" or "alert rule" notification to a Slack user or team. """
    client = SlackClient()
    data = get_channel_and_token_by_recipient(notification.organization, recipients)
    for recipient, (channel, token) in data.items():
        extra_context = (extra_context_by_user_id or {}).get(recipient.id, {})
        context = get_context(notification, recipient, shared_context, extra_context)
        attachment = [build_notification_attachment(notification, context)]
        payload = {
            "token": token,
            "channel": channel,
            "link_names": 1,
            "attachments": json.dumps(attachment),
        }
        try:
            client.post("/chat.postMessage", data=payload, timeout=5)
        except ApiError as e:
            logger.info(
                "notification.fail.slack_post",
                extra={
                    "error": str(e),
                    "notification": notification,
                    "recipient": recipient.id,
                    "channel_id": channel,
                },
            )
            continue

    key = get_key(notification)
    metrics.incr(
        f"{key}.notifications.sent",
        instance=f"slack.{key}.notification",
        skip_internal=False,
    )
