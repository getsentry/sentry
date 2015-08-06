from __future__ import absolute_import

from rest_framework.response import Response

from sentry import status_checks
from sentry.api.base import Endpoint
from sentry.api.permissions import SuperuserPermission


class SystemHealthEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)

    def get(self, request):
        problems, checks = status_checks.check_all()

        return Response({
            'problems': map(unicode, problems),
            'healthy': checks,
        })
