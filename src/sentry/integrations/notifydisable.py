from sentry.models import Organization
from sentry.notifications.notifications.base import BaseNotification
from sentry.services.hybrid_cloud.integration import RpcIntegration

provider_types = {
    "integration": "integrations",
    "plugin": "plugins",
    "sentry-app": "sentry-apps",
}


class NotifyDisable:
    def get_url(self, organization: Organization, provider_type: str, provider_slug: str) -> str:
        type_name = provider_types.get(provider_type, "")
        return str(
            organization.absolute_url(
                f"/settings/{organization.slug}/{type_name}/{provider_slug}/",
            )
        )

    def get_provider_type(self, redis_key) -> str:
        for provider in provider_types:
            if provider in redis_key:
                return provider

    def get_subject(self, integration_name) -> str:
        return f"Your team member requested the {integration_name} integration on Sentry"

    def notifyDisable(
        self, organization=Organization, integration=RpcIntegration, redis_key=str, project=None
    ):

        from sentry import integrations
        from sentry.utils.email import MessageBuilder

        provider = integrations.get(integration.provider)

        integration_name = provider
        integration_link = self.get_url(
            organization, self.get_provider_type(redis_key), integration.provider_slug
        )

        user_email = None
        users = organization.get_owners()

        settings_link = None

        for user in users:

            user_email = user.email

            settings_link = BaseNotification(organization).get_settings_url(user_email, provider)

            msg = MessageBuilder(
                subject=self.get_subject(integration_name),
                context={
                    "integration_name": integration_name,
                    "integration_link": integration_link,
                    "settings_link": settings_link,
                },
                html_template="sentry/integrations/notify-disable.html",
            )

            msg.send_async([user_email])
