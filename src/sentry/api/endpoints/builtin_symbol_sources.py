from __future__ import absolute_import

from rest_framework.response import Response
import six

from django.conf import settings
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
            for key, source in six.iteritems(settings.SENTRY_BUILTIN_SOURCES)
        ]

        sources.sort(key=lambda s: s["name"])
        return Response(serialize(sources))
