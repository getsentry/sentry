from __future__ import absolute_import

from rest_framework.response import Response

from sentry.celery import app
from sentry.api.base import Endpoint
from sentry.api.permissions import SuperuserPermission


class InternalQueueTasksEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)

    def get(self, request):
        return Response(sorted(app.tasks.keys()))
