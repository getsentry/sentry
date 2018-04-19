from __future__ import absolute_import

from rest_framework.response import Response

from sentry.relay import Config
from sentry.models import ProjectKey
from sentry.api.base import Endpoint
from sentry.api.serializers import serialize


class RelayConfig(Endpoint):
    permission_classes = ()

    def get(self, request, public_key):
        """Returns the javascript file for the user to integrate on their website"""
        key = ProjectKey.objects.get(
            public_key=public_key
        )
        config = Config(key.project, key)
        return Response(serialize(config.to_dict()))
