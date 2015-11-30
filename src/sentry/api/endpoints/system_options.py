from __future__ import absolute_import

from rest_framework.response import Response

from sentry import options
from sentry.api.base import Endpoint
from sentry.api.permissions import SuperuserPermission


class SystemOptionsEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)

    option_names = set(['system.url-prefix', 'system.admin-email'])

    def get(self, request):
        results = {
            k: options.get(k)
            for k in self.option_names
        }

        return Response(results)
