from __future__ import absolute_import

import six
from django.core.exceptions import ValidationError
from rest_framework import serializers
from rest_framework.response import Response

from sentry import features
from sentry.api.base import EnvironmentMixin
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationDataExportPermission
from sentry.api.serializers import serialize
from sentry.models import Environment
from sentry.utils import metrics

from ..base import ExportQueryType
from ..models import ExportedData
from ..tasks import assemble_download


class DataExportQuerySerializer(serializers.Serializer):
    query_type = serializers.ChoiceField(choices=ExportQueryType.as_str_choices(), required=True)
    query_info = serializers.JSONField(required=True)


class DataExportEndpoint(OrganizationEndpoint, EnvironmentMixin):
    permission_classes = (OrganizationDataExportPermission,)

    def post(self, request, organization):
        """
        Create a new asynchronous file export task, and
        email user upon completion,
        """
        # Ensure new data-export features are enabled
        if not features.has("organizations:data-export", organization):
            return Response(status=404)

        limit = request.data.get("limit")
        serializer = DataExportQuerySerializer(
            data=request.data, context={"organization": organization, "user": request.user}
        )
        try:
            environment_id = self._get_environment_id_from_request(request, organization.id)
        except Environment.DoesNotExist as error:
            return Response(error, status=400)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data
        # Ensure discover features are enabled if necessary
        if data["query_type"] == ExportQueryType.DISCOVER_STR and not features.has(
            "organizations:discover-basic", organization, actor=request.user
        ):
            return Response({"detail": "You do not have access to discover features"}, status=403)
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
                metrics.incr(
                    "dataexport.enqueue", tags={"query_type": data["query_type"]}, sample_rate=1.0
                )
                assemble_download.delay(
                    data_export_id=data_export.id, limit=limit, environment_id=environment_id
                )
                status = 201
        except ValidationError as e:
            # This will handle invalid JSON requests
            metrics.incr(
                "dataexport.invalid", tags={"query_type": data.get("query_type")}, sample_rate=1.0
            )
            return Response({"detail": six.text_type(e)}, status=400)
        return Response(serialize(data_export, request.user), status=status)
