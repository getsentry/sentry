from django.core.urlresolvers import reverse
from django.utils.encoding import force_text
from rest_framework.response import Response

from sentry import integrations
from sentry.api.bases import OrganizationPermission
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models import SentryApp
from sentry.plugins.base import plugins
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri


class OrganizationIntegrationRequestPermission(OrganizationPermission):
    scope_map = {
        "POST": ["org:read"],
    }


def get_url(organization, provider_type, provider_slug):
    return absolute_uri(
        "/".join(
            [
                "/settings",
                organization.slug,
                {
                    "first_party": "integrations",
                    "plugin": "plugins",
                    "sentry_app": "sentry-apps",
                }.get(provider_type),
                provider_slug,
                "?referrer=request_email",
            ]
        )
    )


def get_provider_name(provider_type, provider_slug):
    """
    The things that users think of as "integrations" are actually three
    different things: integrations, plugins, and sentryapps. A user requesting
    than an integration be installed only actually knows the "provider" they
    want and not what type they want. This function looks up the display name
    for the integration they want installed.

    :param provider_type: One of: "first_party", "plugin", or "sentry_app".
    :param provider_slug: The unique identifier for the provider.
    :return: The display name for the provider.

    :raises: ValueError if provider_type is not one of the three from above.
    :raises: RuntimeError if the provider is not found.
    """
    try:
        if provider_type == "first_party":
            return integrations.get(provider_slug).name
        elif provider_type == "plugin":
            return plugins.get(provider_slug).title
        elif provider_type == "sentry_app":
            return SentryApp.objects.get(slug=provider_slug).name
        else:
            raise ValueError(f"Invalid providerType {provider_type}")
    except (KeyError, SentryApp.DoesNotExist):
        raise RuntimeError(f"Provider {provider_slug} not found")


class OrganizationIntegrationRequestEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationIntegrationRequestPermission,)

    def post(self, request, organization):
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

        try:
            provider_name = get_provider_name(provider_type, provider_slug)
        except RuntimeError as error:
            return Response({"detail": force_text(error)}, status=400)

        requester = request.user
        owners_list = organization.get_owners()

        # If for some reason the user had permissions all along, silently fail.
        if requester.id in [user.id for user in owners_list]:
            return Response({"detail": "User can install integration"}, status=200)

        msg = MessageBuilder(
            subject="Your team member requested the %s integration on Sentry" % provider_name,
            template="sentry/emails/requests/organization-integration.txt",
            html_template="sentry/emails/requests/organization-integration.html",
            type="organization.integration.request",
            context={
                "integration_link": get_url(organization, provider_type, provider_slug),
                "integration_name": provider_name,
                "message": message_option,
                "organization_name": organization.name,
                "requester_name": requester.name or requester.username,
                "requester_link": absolute_uri(
                    f"/settings/{organization.slug}/members/{requester.id}/"
                ),
                "settings_link": absolute_uri(
                    reverse("sentry-organization-settings", args=[organization.slug])
                ),
            },
        )
        msg.send([user.email for user in owners_list])

        return Response(status=201)
