from __future__ import absolute_import

from django.db import IntegrityError, transaction
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationEventPermission
from sentry.api.serializers import serialize
from sentry.models import ExportedData
from sentry.tasks.data_export import compile_data


class DataExportEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationEventPermission,)

    def post(self, request, organization):
        """
        Create a new Asynchronous file export task, and
        email user upon completion,
        """

        if not features.has("organizations:data-export", organization):
            return Response(status=404)

        # TODO(Leander): Implement validator to clean the request
        try:
            with transaction.atomic():
                # TODO(Leander): Prevent repeated requests for identical queries per organization, if one is in progress
                data_export = ExportedData.objects.create(
                    organization=organization,
                    user=request.user,
                    query_type=request.data["query"]["type"],
                    query_info=request.data["query"]["info"],
                )
        except IntegrityError:
            return Response("This exact export is already in progress.", status=409)

        compile_data.delay(data_export=data_export)
        return Response(serialize(data_export, request.user), status=201)
