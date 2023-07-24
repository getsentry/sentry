from sentry.models import Organization
from sentry.services.hybrid_cloud.integration import RpcIntegration

provider_types = {
    "integration": "integrations",
    "plugin": "plugins",
    "sentry-app": "sentry-apps",
}


def get_url(organization: Organization, provider_type: str, provider) -> str:
    type_name = provider_types.get(provider_type, "")
    return str(
        organization.absolute_url(
            f"/settings/{type_name}/{provider}/",
        )
    )


def get_provider_type(redis_key) -> str:
    for provider in provider_types:
        if provider in redis_key:
            return provider


def get_subject(integration_name) -> str:
    return f"Action required: re-authenticate or fix your {integration_name} integration"


def notify_disable(
    organization=Organization, integration=RpcIntegration, redis_key=str, project=None
):

    from sentry import integrations
    from sentry.utils.email import MessageBuilder

    provider = integrations.get(integration.provider)
    integration_name = provider.name
    integration_link = get_url(
        organization,
        get_provider_type(redis_key),
        integration.provider,
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
