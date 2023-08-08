from typing import Union

from sentry import analytics
from sentry.models import Organization
from sentry.utils.email import MessageBuilder

provider_types = {
    "integration": "integrations",
    "plugin": "plugins",
    "sentry-app": "developer-settings",
}


def get_url(organization: Organization, provider_type: str, name: str) -> str:
    if provider_type:
        type_name = provider_types.get(provider_type, "")
        if type_name:
            return str(
                organization.absolute_url(
                    f"/settings/{organization.slug}/{type_name}/{name}/",
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
    integration_name: str,
    redis_key: str,
    integration_slug: Union[str, None] = None,
    webhook_url: Union[str, None] = None,
    project: Union[str, None] = None,
):

    integration_link = get_url(
        organization,
        get_provider_type(redis_key),
        integration_slug if "sentry-app" in redis_key and integration_slug else integration_name,
    )

    for user in organization.get_owners():

        msg = MessageBuilder(
            subject=get_subject(integration_name.title()),
            context={
                "integration_name": integration_name.title(),
                "integration_link": integration_link,
                "webhook_url": webhook_url if "sentry-app" in redis_key and webhook_url else "",
                "dashboard_link": f"{integration_link}dashboard/"
                if "sentry-app" in redis_key
                else "",
            },
            html_template="sentry/integrations/sentry-app-notify-disable.html"
            if "sentry-app" in redis_key and integration_slug
            else "sentry/integrations/notify-disable.html",
            template="sentry/integrations/sentry-app-notify-disable.txt"
            if "sentry-app" in redis_key and integration_slug
            else "sentry/integrations/notify-disable.txt",
        )
        msg.send_async([user.email])

    analytics.record(
        "integration.disabled.notified",
        provider=integration_name,
        organization_id=organization.id,
        redis_key=redis_key,
        integration_slug=integration_slug
        if integration_slug and "sentry-app" in redis_key
        else None,
    )
