import time
from io import BytesIO
from uuid import uuid4
from zipfile import ZipFile

from django.template.defaultfilters import slugify
from google.cloud import storage
from google.cloud.functions_v1.services.cloud_functions_service import CloudFunctionsServiceClient
from google.cloud.functions_v1.services.cloud_functions_service.transports.base import (
    CloudFunctionsServiceTransport,
)
from google.cloud.functions_v1.types import (
    CloudFunction,
    CreateFunctionRequest,
    EventTrigger,
    HttpsTrigger,
    ListFunctionsRequest,
)
from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases import OrganizationEndpoint
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.models import SentryFunction

from .organization_sentry_function import SentryFunctionSerilizer


class SentryFunctionSerilizer(CamelSnakeSerializer):
    name = serializers.CharField()
    code = serializers.CharField()
    author = serializers.CharField(required=False, allow_blank=True)
    overview = serializers.CharField(required=False, allow_blank=True)
    events = serializers.ListField(child=serializers.CharField(), required=False)


class OrganizationSentryFunctionDetailsEndpoint(OrganizationEndpoint):
    def put(self, request, organization, function_slug):
        serializer = SentryFunctionSerilizer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data
        # TODO: call APIs
        try:
            function = SentryFunction.objects.get(slug=function_slug)
        except SentryFunction.DoesNotExist:
            return Response(status=404)

        function.update(**data)
        return Response(status=201)
