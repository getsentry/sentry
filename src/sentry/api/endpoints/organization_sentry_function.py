from uuid import uuid4

from django.template.defaultfilters import slugify
from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.models import SentryFunction
from sentry.utils.cloudfunctions import create_function


class EnvVariableSerializer(CamelSnakeSerializer):
    value = serializers.CharField()
    name = serializers.CharField()


class SentryFunctionSerializer(CamelSnakeSerializer):
    name = serializers.CharField()
    code = serializers.CharField()
    author = serializers.CharField(required=False, allow_blank=True)
    overview = serializers.CharField(required=False, allow_blank=True)
    events = serializers.ListField(child=serializers.CharField(), required=False)
    env_variables = serializers.ListField(child=EnvVariableSerializer())

    def validate_env_variables(self, env_variables):
        output = {}
        for env_variable in env_variables:
            # skip over invalid entries for now
            if env_variable.get("name", None) and env_variable.get("value", None):
                output[env_variable["name"]] = env_variable["value"]
        return output


class OrganizationSentryFunctionEndpoint(OrganizationEndpoint):
    def post(self, request, organization):
        serializer = SentryFunctionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data
        data["slug"] = slugify(data["name"])
        data["organization_id"] = organization.id
        data["external_id"] = "fn-" + data["slug"] + "-" + uuid4().hex

        create_function(data["code"], data["external_id"])
        SentryFunction.objects.create(**data)

        return Response(status=201)

    def get(self, request, organization):
        functions = SentryFunction.objects.filter(organization=organization)
        return Response(serialize(list(functions), request.user), status=200)
