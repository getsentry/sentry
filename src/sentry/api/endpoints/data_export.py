from __future__ import absolute_import

import six
from django.core.exceptions import ValidationError
from rest_framework import serializers
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationEventPermission
from sentry.api.serializers import serialize
from sentry.constants import ExportQueryType
from sentry.models import ExportedData
from sentry.tasks.data_export import assemble_download


class ExportedDataSerializer(serializers.Serializer):
    max_value = len(ExportQueryType.as_choices()) - 1
    query_type = serializers.IntegerField(required=True, min_value=0, max_value=max_value)
    query_info = serializers.JSONField(required=True)
    # TODO(Leander): Implement query_info validation with jsonschema


class DataExportEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationEventPermission,)

    def post(self, request, organization):
        """
        Create a new asynchronous file export task, and
        email user upon completion,
        """

        if not features.has("organizations:data-export", organization):
            return Response(status=404)

        serializer = ExportedDataSerializer(
            data=request.data, context={"organization": organization, "user": request.user}
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data

        try:
            # TODO(Leander): Prevent repeated requests for identical queries per organization, if one is in progress
            data_export = ExportedData.objects.create(
                organization=organization,
                user=request.user,
                query_type=data["query_type"],
                query_info=data["query_info"],
            )
        except ValidationError as e:
            # This will handle invalid JSON requests
            return Response({"detail": six.text_type(e)}, status=400)

        assemble_download.delay(data_export=data_export)
        return Response(serialize(data_export, request.user), status=201)
