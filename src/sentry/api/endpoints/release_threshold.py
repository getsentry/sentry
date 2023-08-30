from rest_framework.request import HttpResponse, Request
from rest_framework.response import Response

from sentry.api import serializers
from sentry.api.api_owners import ApiOwner
from sentry.api.base import Endpoint
from sentry.models import Project


class ReleaseThresholdSerializer(serializers.Serializer):
    pass


class ReleaseThresholdEndpoint(Endpoint):
    owner: ApiOwner = ApiOwner.ENTERPRISE

    def post(self, request: Request, project: Project) -> HttpResponse:
        serializer = ReleaseThresholdSerializer(
            data=request.data, context={"project": project, "access": request.access}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
