from __future__ import absolute_import

import six
from django.core.exceptions import ValidationError
from rest_framework import serializers
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationDataExportPermission
from sentry.api.serializers import serialize
from sentry.constants import ExportQueryType
from sentry.models import ExportedData
from sentry.tasks.data_export import assemble_download
from sentry.utils import metrics


class ExportedDataSerializer(serializers.Serializer):
    query_type = serializers.ChoiceField(choices=ExportQueryType.as_str_choices(), required=True)
    # TODO(Leander): Implement query_info validation with jsonschema
    query_info = serializers.JSONField(required=True)


class DataExportEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationDataExportPermission,)

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
            # If this user has sent a sent a request with the same payload and organization,
            # we return them the latest one that is NOT complete (i.e. don't start another)
            query_type = ExportQueryType.from_str(data["query_type"])
            data_export, created = ExportedData.objects.get_or_create(
                organization=organization,
                user=request.user,
                query_type=query_type,
                query_info=data["query_info"],
                date_finished=None,
            )
            status = 200
            if created:
                metrics.incr("dataexport.start", tags={"query_type": data["query_type"]})
                assemble_download.delay(data_export_id=data_export.id)
                status = 201
        except ValidationError as e:
            # This will handle invalid JSON requests
            metrics.incr("dataexport.invalid", tags={"query_type": data.get("query_type")})
            return Response({"detail": six.text_type(e)}, status=400)
        return Response(serialize(data_export, request.user), status=status)
