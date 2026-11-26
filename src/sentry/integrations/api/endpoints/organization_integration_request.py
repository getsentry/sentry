from __future__ import annotations

from typing import TYPE_CHECKING

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization_request_change import OrganizationRequestChangeEndpoint
from sentry.auth.principal import is_acting_user
from sentry.integrations.manager import default_manager as integrations
from sentry.notifications.notifications.organization_request.integration_request import (
    CATEGORY_PROVIDER_TYPE,
    REQUESTABLE_CATEGORIES,
    SCM_CATEGORY,
    IntegrationRequestNotification,
)
from sentry.notifications.utils.tasks import async_send_notification
from sentry.sentry_apps.services.app import app_service

if TYPE_CHECKING:
    from django.utils.functional import _StrPromise

    from sentry.models.organization import Organization


def get_provider_name(provider_type: str, provider_slug: str) -> str | _StrPromise | None:
    """
    The things that users think of as "integrations" are actually three
    different things: integrations, plugins, and sentryapps. A user requesting
    than an integration be installed only actually knows the "provider" they
    want and not what type they want. This function looks up the display name
    for the integration they want installed.

    :param provider_type: One of: "first_party", "plugin", "sentry_app", or "category".
    :param provider_slug: The unique identifier for the provider, or for "category", an
                          integrations directory category such as "source code management".
    :return: The display name for the provider or None.
    """
    if provider_type == CATEGORY_PROVIDER_TYPE:
        return provider_slug if provider_slug in REQUESTABLE_CATEGORIES else None
    if provider_type == "first_party":
        if integrations.exists(provider_slug):
            return integrations.get(provider_slug).name
    elif provider_type == "sentry_app":
        sentry_app = app_service.get_sentry_app_by_slug(slug=provider_slug)
        if sentry_app:
            return sentry_app.name
    return None


@cell_silo_endpoint
class OrganizationIntegrationRequestEndpoint(OrganizationRequestChangeEndpoint):
    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(self, request: Request, organization: Organization) -> Response:
        """
        Email the organization owners asking them to install an integration.
        ````````````````````````````````````````````````````````````````````
        When a non-owner user views integrations in the integrations directory,
        they lack the ability to install them themselves. POSTing to this API
        alerts users with permission that there is demand for this integration.

        :param string providerSlug: Unique string that identifies the integration, or with
                                    providerType "category", an integrations directory
                                    category such as "source code management". Leave it and
                                    providerType out to request any integration.
        :param string providerType: One of: first_party, plugin, sentry_app, category.
        :param string message: Optional message from the requester to the owners.
        :param string repoName: With the "source code management" category, the repo source
                                control is needed for, if any. The email's button opens the
                                modal that connects source control, for this repo.
        """

        provider_type = request.data.get("providerType")
        provider_slug = request.data.get("providerSlug")
        message_option = request.data.get("message", "").strip()
        repo_name = request.data.get("repoName")

        requester = request.user
        if any(is_acting_user(requester, user.id) for user in organization.get_owners()):
            return Response({"detail": "User can install integration"}, status=200)

        provider_name = None
        if provider_slug is not None or provider_type is not None:
            provider_type = str(provider_type)
            provider_slug = str(provider_slug)
            provider_name = get_provider_name(provider_type, provider_slug)
            if not provider_name:
                return Response({"detail": f"Provider {provider_slug} not found"}, status=400)

        if (
            provider_type != CATEGORY_PROVIDER_TYPE
            or provider_slug != SCM_CATEGORY
            or not features.has(
                "organizations:ask-seer-scm-connect-prompt", organization, actor=request.user
            )
        ):
            repo_name = None
        elif not isinstance(repo_name, str):
            repo_name = ""

        async_send_notification(
            IntegrationRequestNotification,
            organization,
            requester,
            provider_type,
            provider_slug,
            provider_name,
            message_option,
            **({"repo_name": repo_name} if repo_name is not None else {}),
        )

        return Response(status=201)
