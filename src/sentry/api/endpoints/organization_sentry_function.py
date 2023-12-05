from uuid import uuid4

from rest_framework import serializers
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.helpers.slugs import sentry_slugify
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.models.sentryfunction import SentryFunction
from sentry.utils.cloudfunctions import create_function


class EnvVariableSerializer(CamelSnakeSerializer):
    value = serializers.CharField(required=True, allow_blank=False, allow_null=False)
    name = serializers.CharField(required=True, allow_blank=False, allow_null=False)


class SentryFunctionSerializer(CamelSnakeSerializer):
    name = serializers.CharField(required=True)
    author = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    code = serializers.CharField(required=True)
    overview = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    events = serializers.ListField(child=serializers.CharField(), required=False)
    env_variables = serializers.ListField(child=EnvVariableSerializer())

    def validate_env_variables(self, env_variables):
        """
        Convert env_variables from a list of dicts to a dict of key-value pairs
        """
        output = {}
        for env_variable in env_variables:
            output[env_variable["name"]] = env_variable["value"]
        return output


@region_silo_endpoint
class OrganizationSentryFunctionEndpoint(OrganizationEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }

    # Creating a new sentry function

    def post(self, request, organization):
        if not features.has("organizations:sentry-functions", organization, actor=request.user):
            return Response("organizations:sentry-functions flag set to false", status=404)
        serializer = SentryFunctionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data
        # sentry_slugify ensures the slug is not entirely numeric
        data["slug"] = sentry_slugify(data["name"])

        # TODO: Make sure the slug is unique
        # Currently slug unique within organization
        # In future, may add "global_slug" so users can publish their functions
        data["organization_id"] = organization.id
        data["external_id"] = data["slug"] + "-" + uuid4().hex
        create_function(
            data["code"], data["external_id"], data.get("overview", None), data["env_variables"]
        )
        function = SentryFunction.objects.create(**data)
        return Response(serialize(function), status=201)

    def get(self, request, organization):
        if not features.has("organizations:sentry-functions", organization, actor=request.user):
            return Response("organizations:sentry-functions flag set to false", status=404)
        functions = SentryFunction.objects.filter(organization=organization)
        return Response(serialize(list(functions), request.user), status=200)
