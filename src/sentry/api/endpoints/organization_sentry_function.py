from uuid import uuid4

from django.template.defaultfilters import slugify
from rest_framework import serializers
from rest_framework.response import Response

from sentry import features
from sentry.api.bases import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.models.sentryfunction import SentryFunction


class SentryFunctionSerializer(CamelSnakeSerializer):
    name = serializers.CharField()
    author = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class OrganizationSentryFunctionEndpoint(OrganizationEndpoint):
    private = True
    # Creating a new sentry function

    def post(self, request, organization):
        if not features.has("organizations:sentry-functions", organization, actor=request.user):
            return Response("organizations:sentry-functions flag set to false", status=404)

        serializer = SentryFunctionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data
        data["slug"] = slugify(data["name"])
        # TODO: Make sure the slug is unique
        # Currently slug unique within organization
        # In future, may add "global_slug" so users can publish their functions
        data["organization_id"] = organization.id
        data["external_id"] = data["slug"] + "-" + uuid4().hex
        function = SentryFunction.objects.create(**data)
        return Response(serialize(function), status=201)

    # def get(self, request, organization):
    #     functions = SentryFunction.objects.filter(organization=organization)
    #     return Response(serialize(list(functions), request.user), status=200)
