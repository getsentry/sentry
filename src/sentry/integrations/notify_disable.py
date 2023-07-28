from typing import Union

from sentry.models import Organization
from sentry.utils.email import MessageBuilder

provider_types = {
    "integration": "integrations",
    "plugin": "plugins",
    "sentry-app": "developer-settings",
}


def get_url(organization: Organization, provider_type: str, provider: str) -> str:
    if not provider_type:
        return str(organization.absolute_url("/settings/integrations/"))

    type_name = provider_types.get(provider_type, "")
    return str(
        organization.absolute_url(
            f"/settings/{type_name}/{provider}/",
        )
    )


def get_provider_type(redis_key: str) -> str:
    for provider in provider_types:
        if provider in redis_key:
            return provider

    return ""


def get_subject(integration_name: str) -> str:
    return f"Action required: re-authenticate or fix your {integration_name} integration"


def notify_disable(
    organization: Organization,
    integration_name: str,
    redis_key: str,
    project: Union[str, None] = None,
):

    integration_link = get_url(
        organization,
        get_provider_type(redis_key),
        integration_name,
    )

    users = organization.get_owners()

    for user in users:

        user_email = user.email

        msg = MessageBuilder(
            subject=get_subject(integration_name),
            context={"integration_name": integration_name, "integration_link": integration_link},
            html_template="sentry/integrations/notify-disable.html",
            template="sentry/integrations/notify-disable.txt",
        )
        msg.send_async([user_email])
