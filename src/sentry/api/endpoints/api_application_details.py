from __future__ import absolute_import

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from sentry.api.base import Endpoint, SessionAuthentication
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import ApiApplication, ApiApplicationStatus


class ApiApplicationsEndpoint(Endpoint):
    authentication_classes = (
        SessionAuthentication,
    )
    permission_classes = (
        IsAuthenticated,
    )

    def get(self, request, app_id):
        try:
            instance = ApiApplication.objects.get(
                owner=request.user,
                id=app_id,
                status=ApiApplicationStatus.active,
            )
        except ApiApplication.DoesNotExist:
            raise ResourceDoesNotExist

        return Response(serialize(instance, request.user))

    def delete(self, request, app_id):
        ApiApplication.objects.filter(
            id=app_id,
            owner=request.user,
        ).update(
            status=ApiApplicationStatus.inactive,
        )

        return Response(status=204)
