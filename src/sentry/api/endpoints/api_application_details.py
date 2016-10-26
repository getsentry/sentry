from __future__ import absolute_import

from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from sentry.api.base import Endpoint, SessionAuthentication
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import ApiApplication, ApiApplicationStatus


class ApiApplicationSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64)


class ApiApplicationDetailsEndpoint(Endpoint):
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

    def put(self, request, app_id):
        try:
            instance = ApiApplication.objects.get(
                owner=request.user,
                id=app_id,
                status=ApiApplicationStatus.active,
            )
        except ApiApplication.DoesNotExist:
            raise ResourceDoesNotExist

        serializer = ApiApplicationSerializer(data=request.DATA)

        if serializer.is_valid():
            result = serializer.object
            instance.update(**result)
            return Response(serialize(instance, request.user), status=201)
        return Response(serializer.errors, status=400)

    def delete(self, request, app_id):
        try:
            instance = ApiApplication.objects.get(
                owner=request.user,
                id=app_id,
                status=ApiApplicationStatus.active,
            )
        except ApiApplication.DoesNotExist:
            raise ResourceDoesNotExist

        ApiApplication.objects.filter(
            id=instance.id,
        ).update(
            status=ApiApplicationStatus.inactive,
        )

        return Response(status=204)
