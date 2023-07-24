from django.urls import reverse

from sentry.models import Organization
from sentry.notifications.notifications.base import BaseNotification
from sentry.services.hybrid_cloud.integration import RpcIntegration
from sentry.services.hybrid_cloud.actor import ActorType, RpcActor
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders


provider_types = {
    "integration": "integrations",
    "plugin": "plugins",
    "sentry-app": "sentry-apps",
}




def get_url(organization: Organization, provider_type: str) -> str:
    type_name = provider_types.get(provider_type, "")
    return str(
        organization.absolute_url(
            f"/settings/{organization.slug}/{type_name}/",
        )
    )

def get_provider_type(redis_key) -> str:
    for provider in provider_types:
        if provider in redis_key:
            return provider


def get_subject(integration_name) -> str:
    return f"Your team member requested the {integration_name} integration on Sentry"


def notify_disable(organization=Organization, integration=RpcIntegration, redis_key=str, project=None):

    from sentry import integrations
    from sentry.utils.email import MessageBuilder

    provider = integrations.get(integration.provider)

    integration_name = provider
    integration_link = get_url(
        organization, get_provider_type(redis_key),
    )
    settings_link = organization.absolute_url(reverse("sentry-organization-settings", args=[organization.slug]))

    user_email = None
    users = organization.get_owners()

    print("Users: ", users)
    for user in users:

        user_email = user.email


        msg = MessageBuilder(
            subject=get_subject(integration_name),
            context={
                "integration_name": integration_name,
                "integration_link": integration_link,
                "settings_link": settings_link,
            },
            html_template="sentry/integrations/notify-disable.html",
            template="sentry/integrations/notify-disable.txt",
        )

        msg.send_async([user_email])

        print("Email sent to: ", user_email)
