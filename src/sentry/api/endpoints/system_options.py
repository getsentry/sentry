from __future__ import absolute_import

from rest_framework.response import Response

import sentry
from sentry import options
from sentry.api.base import Endpoint
from sentry.api.permissions import SuperuserPermission

from django.conf import settings


class SystemOptionsEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)

    def get(self, request):
        results = {
            k.name: {
                'value': options.get(k.name),
                'field': {
                    'default': k.default,
                    'required': True,
                    # TODO(mattrobenolt): Expose this as a property on Key.
                    'disabled': bool(k.flags & options.FLAG_PRIORITIZE_DISK and settings.SENTRY_OPTIONS.get(k.name))
                    # TODO(mattrobenolt): help, placeholder, title, type
                },
            }
            for k in options.filter(flag=options.FLAG_REQUIRED)
        }

        return Response(results)

    def put(self, request):
        try:
            for k, v in request.DATA.iteritems():
                options.set(k, v)
        except Exception as e:
            return Response(unicode(e), status=400)
        options.set('sentry:version-configured', sentry.get_version())
        return Response(status=200)
