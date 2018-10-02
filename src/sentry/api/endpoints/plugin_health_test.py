from __future__ import absolute_import

from sentry.models import PluginHealth, PluginHealthTest
from sentry.api.serializers import serialize
from sentry.api.paginator import OffsetPaginator
from sentry.api.base import Endpoint
from rest_framework.response import Response
from rest_framework import status


class PluginHealthTestEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    def get(self, request, plugin):
        queryset = PluginHealthTest.objects.filter(
            plugin=plugin,
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='date_added',
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )

    def post(self, request):
        try:
            plugin = PluginHealth.objects.get(
                name=request.DATA['plugin'],
            )
        except PluginHealth.DoesNotExist:
            return Response(
                {
                    'detail': 'A plugin with this name does not exist.'
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        test_results = plugin.run_test()
        return Response(serialize(test_results, request.user), status=status.HTTP_201_CREATED)
