from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.serializers import serialize
from sentry.constants import ENABLED_CONSOLE_PLATFORMS_DEFAULT
from sentry.models.organization import Organization


def normalize_symbol_source(key, source):
    return {
        "sentry_key": key,
        "id": source["id"],
        "name": source["name"],
        "hidden": bool(source.get("hidden")),
    }


def organization_has_console_platform_access(
    organization: Organization, platform: str
) -> bool:
    """
    Check if an organization has access to a specific console platform.

    Args:
        organization: The organization to check
        platform: The console platform (e.g., 'nintendo-switch', 'playstation', 'xbox')

    Returns:
        True if the organization has access to the console platform, False otherwise
    """
    enabled_console_platforms = organization.get_option(
        "sentry:enabled_console_platforms", ENABLED_CONSOLE_PLATFORMS_DEFAULT
    )
    return platform in enabled_console_platforms


@region_silo_endpoint
class BuiltinSymbolSourcesEndpoint(Endpoint):
    owner = ApiOwner.OWNERS_INGEST
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = ()

    def get(self, request: Request, **kwargs) -> Response:
        platform = request.GET.get("platform")

        # Get organization if organization context is available
        organization = None
        organization_id_or_slug = kwargs.get("organization_id_or_slug")
        if organization_id_or_slug:
            try:
                if str(organization_id_or_slug).isdecimal():
                    organization = Organization.objects.get_from_cache(id=organization_id_or_slug)
                else:
                    organization = Organization.objects.get_from_cache(
                        slug=organization_id_or_slug
                    )
            except Organization.DoesNotExist:
                pass

        sources = []
        for key, source in settings.SENTRY_BUILTIN_SOURCES.items():
            source_platforms = source.get("platforms")

            # If source has platform restrictions, check if current platform matches
            if source_platforms is not None:
                if not platform or platform not in source_platforms:
                    continue

                # Platform matches - now check if organization has access to this console platform
                if not organization or not organization_has_console_platform_access(
                    organization, platform
                ):
                    continue

            sources.append(normalize_symbol_source(key, source))

        sources.sort(key=lambda s: s["name"])
        return Response(serialize(sources))
