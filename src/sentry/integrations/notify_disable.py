from typing import Union

from sentry.models import Organization, SentryApp
from sentry.services.hybrid_cloud.integration import RpcIntegration
from sentry.utils.email import MessageBuilder

provider_types = {
    "integration": "integrations",
    "plugin": "plugins",
    "sentry-app": "developer-settings",
}


def get_url(organization: Organization, provider_type: str, slug: str) -> str:
    if provider_type:
        type_name = provider_types.get(provider_type, "")
        if type_name:
            return str(
                organization.absolute_url(
                    f"/settings/{organization.slug}/{type_name}/{slug}/",
                )
            )

    return str(organization.absolute_url("/settings/integrations/"))


def get_provider_type(redis_key: str) -> str:
    for provider in provider_types:
        if provider in redis_key:
            return provider

    return ""


def get_subject(integration_name: str) -> str:
    return f"Action required: re-authenticate or fix your {integration_name} integration"


def notify_disable(
    organization: Organization,
    integration: Union[SentryApp, RpcIntegration],
    redis_key: str,
    project: Union[str, None] = None,
):

    integration_link = get_url(
        organization,
        get_provider_type(redis_key),
        integration.provider if integration.get_provider() else integration.slug,
    )

    integration_name = (
        integration.get_provider().name if integration.get_provider() else integration.name
    )

    for user in organization.get_owners():

        msg = MessageBuilder(
            subject=get_subject(integration_name.title()),
            context={
                "integration_name": integration_name.title(),
                "integration_link": integration_link,
            },
            html_template="sentry/integrations/notify-disable.html",
            template="sentry/integrations/notify-disable.txt",
        )
        msg.send_async([user.email])
