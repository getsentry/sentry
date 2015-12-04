from __future__ import absolute_import

from rest_framework.response import Response

from sentry import options
from sentry.api.base import Endpoint
from sentry.api.permissions import SuperuserPermission


class SystemOptionsEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)

    def get(self, request):
        results = {
            k.name: {
                'value': options.get(k.name),
                'field': {
                    'default': k.default,
                    'required': True,
                    # TODO(mattrobenolt): help, placeholder, title, type
                },
            }
            for k in options.filter(flag=options.FLAG_REQUIRED)
        }

        return Response(results)
