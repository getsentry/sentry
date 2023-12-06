from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.serializers import serialize


def normalize_symbol_source(key, source):
    return {
        "sentry_key": key,
        "id": source["id"],
        "name": source["name"],
        "hidden": bool(source.get("hidden")),
    }


@region_silo_endpoint
class BuiltinSymbolSourcesEndpoint(Endpoint):
    owner = ApiOwner.OWNERS_NATIVE
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = ()

    def get(self, request: Request, **kwargs) -> Response:
        sources = [
            normalize_symbol_source(key, source)
            for key, source in settings.SENTRY_BUILTIN_SOURCES.items()
        ]

        sources.sort(key=lambda s: s["name"])
        return Response(serialize(sources))
