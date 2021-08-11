from django.http import Http404
from rest_framework.response import Response

from sentry.api.bases import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models import SentryFunction
from sentry.utils.cloudfunctions import update_function

from .organization_sentry_function import SentryFunctionSerializer


class OrganizationSentryFunctionDetailsEndpoint(OrganizationEndpoint):
    def convert_args(self, request, organization_slug, function_slug, *args, **kwargs):
        args, kwargs = super().convert_args(request, organization_slug, *args, **kwargs)

        try:
            function = SentryFunction.objects.get(slug=function_slug)
        except SentryFunction.DoesNotExist:
            raise Http404

        kwargs["function"] = function
        return (args, kwargs)

    def put(self, request, organization, function):
        serializer = SentryFunctionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data
        env_variables = data["env_variables"]
        function.update(**data)

        update_function(function.code, function.external_id, env_variables, data.get("overview", None))

        return Response(serialize(function), status=201)

    def get(self, request, organization, function):
        return Response(serialize(function))
