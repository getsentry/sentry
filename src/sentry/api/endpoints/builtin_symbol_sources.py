from django.conf import settings
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.serializers import serialize


def normalize_symbol_source(key, source):
    return {
        "sentry_key": key,
        "id": source["id"],
        "name": source["name"],
        "hidden": bool(source.get("hidden")),
    }


class BuiltinSymbolSourcesEndpoint(Endpoint):
    permission_classes = ()

    def get(self, request):
        sources = [
            normalize_symbol_source(key, source)
            for key, source in settings.SENTRY_BUILTIN_SOURCES.items()
        ]

        sources.sort(key=lambda s: s["name"])
        return Response(serialize(sources))
