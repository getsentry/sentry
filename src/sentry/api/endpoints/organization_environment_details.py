from django.db import IntegrityError
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import Environment, EnvironmentBookmark


class OrganizationEnvironmentSerializer(serializers.Serializer):
    isBookmarked = serializers.BooleanField()


class OrganizationEnvironmentDetailsEndpoint(OrganizationEndpoint):
    def get(self, request: Request, organization, environment) -> Response:
        try:
            instance = Environment.objects.get(
                organization_id=organization.id,
                name=Environment.get_name_from_path_segment(environment),
            )
        except Environment.DoesNotExist:
            raise ResourceDoesNotExist

        return Response(serialize(instance, request.user))

    def put(self, request: Request, organization, environment) -> Response:
        try:
            instance = Environment.objects.get(
                organization_id=organization.id,
                name=Environment.get_name_from_path_segment(environment),
            )
        except Environment.DoesNotExist:
            raise ResourceDoesNotExist

        serializer = OrganizationEnvironmentSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data

        if data.get("isBookmarked"):
            try:
                EnvironmentBookmark.objects.create(environment_id=instance.id, user=request.user)
            except IntegrityError:
                pass
        elif data.get("isBookmarked") is False:
            EnvironmentBookmark.objects.filter(
                environment_id=instance.id, user=request.user
            ).delete()

        return Response(serialize(instance, request.user))
