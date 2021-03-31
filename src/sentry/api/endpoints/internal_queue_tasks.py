from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.permissions import SuperuserPermission
from sentry.celery import app


class InternalQueueTasksEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)

    def get(self, request):
        return Response(sorted(app.tasks.keys()))
