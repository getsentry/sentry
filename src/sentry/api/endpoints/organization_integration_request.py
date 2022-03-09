from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import integrations
from sentry.api.bases.organization_request_change import OrganizationRequestChangeEndpoint
from sentry.models import SentryApp
from sentry.notifications.notifications.organization_request.integration_request import (
    IntegrationRequestNotification,
)
from sentry.notifications.utils.tasks import async_send_notification
from sentry.plugins.base import plugins


def get_provider_name(provider_type: str, provider_slug: str) -> str | None:
    """
    The things that users think of as "integrations" are actually three
    different things: integrations, plugins, and sentryapps. A user requesting
    than an integration be installed only actually knows the "provider" they
    want and not what type they want. This function looks up the display name
    for the integration they want installed.

    :param provider_type: One of: "first_party", "plugin", or "sentry_app".
    :param provider_slug: The unique identifier for the provider.
    :return: The display name for the provider or None.
    """
    if provider_type == "first_party":
        if integrations.exists(provider_slug):
            return integrations.get(provider_slug).name
    elif provider_type == "plugin":
        if plugins.exists(provider_slug):
            return plugins.get(provider_slug).title
    elif provider_type == "sentry_app":
        sentry_app = SentryApp.objects.filter(slug=provider_slug).first()
        if sentry_app:
            return sentry_app.name
    return None


class OrganizationIntegrationRequestEndpoint(OrganizationRequestChangeEndpoint):
    def post(self, request: Request, organization) -> Response:
        """
        Email the organization owners asking them to install an integration.
        ````````````````````````````````````````````````````````````````````
        When a non-owner user views integrations in the integrations directory,
        they lack the ability to install them themselves. POSTing to this API
        alerts users with permission that there is demand for this integration.

        :param string providerSlug: Unique string that identifies the integration.
        :param string providerType: One of: first_party, plugin, sentry_app.
        :param string message: Optional message from the requester to the owners.
        """

        provider_type = request.data.get("providerType")
        provider_slug = request.data.get("providerSlug")
        message_option = request.data.get("message", "").strip()

        requester = request.user
        if requester.id in [user.id for user in organization.get_owners()]:
            return Response({"detail": "User can install integration"}, status=200)

        provider_name = get_provider_name(provider_type, provider_slug)
        if not provider_name:
            return Response({"detail": f"Provider {provider_slug} not found"}, status=400)

        async_send_notification(
            IntegrationRequestNotification,
            organization,
            requester,
            provider_type,
            provider_slug,
            provider_name,
            message_option,
        )

        return Response(status=201)
