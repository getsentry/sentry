from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, all_silo_endpoint
from sentry.api.permissions import SuperuserPermission
from sentry.celery import app


@all_silo_endpoint
class InternalQueueTasksEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)

    def get(self, request: Request) -> Response:
        return Response(sorted(app.tasks.keys()))
