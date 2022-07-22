from django.http import Http404
from rest_framework.response import Response

from sentry.api.bases import OrganizationEndpoint
from sentry.api.endpoints.organization_sentry_function import SentryFunctionSerializer
from sentry.api.serializers import serialize
from sentry.models.sentryfunction import SentryFunction

# from sentry.utils.cloudfunctions import delete_function, update_function


class OrganizationSentryFunctionDetailsEndpoint(OrganizationEndpoint):
    def convert_args(self, request, organization_slug, function_slug, *args, **kwargs):
        args, kwargs = super().convert_args(request, organization_slug, *args, **kwargs)

        try:
            function = SentryFunction.objects.get(slug=function_slug)
        except SentryFunction.DoesNotExist:
            raise Http404

        kwargs["function"] = function
        return (args, kwargs)

    def get(self, request, organization, function):
        return Response(serialize(function))

    def put(self, request, organization, function):
        serializer = SentryFunctionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data
        function.update(**data)

        # update_function(
        #     function.code, function.external_id, env_variables, data.get("overview", None)
        # )

        return Response(serialize(function), status=201)

    def delete(self, request, organization, function):
        # If an operation on the function is still in progress, it will raise
        # an exception. Retrying when the operation has finished deletes the
        # function successfully.
        # try:
        #     # delete_function(function.external_id)
        # except Exception:
        #     # for hackweek, just eat the error and move on
        #     pass
        SentryFunction.objects.filter(organization=organization, name=function.name).delete()
        return Response(status=204)
