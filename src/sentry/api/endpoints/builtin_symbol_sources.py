from typing import cast

from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models.organization import Organization
from sentry.utils.console_platforms import organization_has_console_platform_access


def normalize_symbol_source(key, source):
    return {
        "sentry_key": key,
        "id": source["id"],
        "name": source["name"],
        "hidden": bool(source.get("hidden")),
    }


@cell_silo_endpoint
class BuiltinSymbolSourcesEndpoint(OrganizationEndpoint):
    owner = ApiOwner.OWNERS_INGEST
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: Organization, **kwargs) -> Response:
        platform = request.GET.get("platform")

        sources = []
        for key, source in settings.SENTRY_BUILTIN_SOURCES.items():
            source_platforms: list[str] | None = cast("list[str] | None", source.get("platforms"))

            # If source has platform restrictions, only show it if:
            # 1. A platform is specified (required to view platform-restricted sources), AND
            # 2. The organization has access to at least one of the source's
            #    required console platforms.
            #
            # Any project type can see console sources if the org has the necessary
            # access. Auto-enable still only applies to recognized project platforms.
            if source_platforms is not None:
                if not platform:
                    continue
                has_access = any(
                    organization_has_console_platform_access(organization, p)
                    for p in source_platforms
                )
                if not has_access:
                    continue

            sources.append(normalize_symbol_source(key, source))

        sources.sort(key=lambda s: s["name"])
        return Response(serialize(sources))
