from django.http import Http404
from google.api_core.exceptions import FailedPrecondition, InvalidArgument, NotFound
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.endpoints.organization_sentry_function import SentryFunctionSerializer
from sentry.api.serializers import serialize
from sentry.models.sentryfunction import SentryFunction
from sentry.utils.cloudfunctions import delete_function, update_function


@region_silo_endpoint
class OrganizationSentryFunctionDetailsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }

    def convert_args(self, request, organization_slug, function_slug, *args, **kwargs):
        args, kwargs = super().convert_args(request, organization_slug, *args, **kwargs)

        try:
            function = SentryFunction.objects.get(
                slug=function_slug, organization=kwargs["organization"].id
            )
        except SentryFunction.DoesNotExist:
            raise Http404

        kwargs["function"] = function
        return (args, kwargs)

    def get(self, request, organization, function):
        if not features.has("organizations:sentry-functions", organization, actor=request.user):
            return Response(status=404)
        return Response(serialize(function), status=200)

    def put(self, request, organization, function):
        if not features.has("organizations:sentry-functions", organization, actor=request.user):
            return Response(status=404)
        serializer = SentryFunctionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data

        try:
            update_function(
                data.get("code"),
                function.external_id,
                data.get("overview", None),
                data["env_variables"],
            )
            function.update(**data)
            return Response(serialize(function), status=201)
        except FailedPrecondition:
            raise ParseError(detail="Function is currently busy, try again later.")

    def delete(self, request, organization, function):
        # If the function is being executed, the delete request will stop the function
        # from executing and delete the function.
        # If an operation is being performed on the function, the delete request will
        # not go through
        try:
            delete_function(function.external_id)
        except FailedPrecondition:
            raise ParseError(detail="Function is currently busy, try again later.")
        except InvalidArgument:
            return Response(status=400)
        except NotFound:
            return Response(status=404)
        SentryFunction.objects.filter(
            organization=organization, name=function.name, external_id=function.external_id
        ).delete()
        return Response(status=204)
