from typing import Union

from sentry import analytics
from sentry.models.organization import Organization
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


def get_sentry_app_subject(integration_name: str) -> str:
    return f"Action required: Fix your {integration_name} integration"


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

    referrer = (
        "?referrer=disabled-sentry-app"
        if "sentry-app" in redis_key
        else "?referrer=disabled-integration"
    )

    for user in organization.get_owners():

        msg = MessageBuilder(
            subject=get_sentry_app_subject(integration_name.title())
            if "sentry-app" in redis_key
            else get_subject(integration_name.title()),
            context={
                "integration_name": integration_name.title(),
                "integration_link": f"{integration_link}{referrer}",
                "webhook_url": webhook_url if "sentry-app" in redis_key and webhook_url else "",
                "dashboard_link": f"{integration_link}dashboard/{referrer}"
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
        organization_id=organization.id,
        provider=integration_slug
        if integration_slug and "sentry-app" in redis_key
        else integration_name,  # integration_name is the provider for first party integrations
        integration_type=("sentry_app" if "sentry-app" in redis_key else "first-party"),
        integration_id=redis_key[redis_key.find(":") + 1 :],
        user_id=organization.default_owner_id,
    )
