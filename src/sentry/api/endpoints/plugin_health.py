from sentry.constants import ObjectStatus
from sentry.models import PluginHealth
from sentry.api.serializers import serialize
from sentry.api.paginator import OffsetPaginator
from sentry.api.base import Endpoint
from rest_framework.response import Response
from django.db import IntegrityError, transaction
from rest_framework import status
from sentry.api.serializers.models import PluginHealthSerializer


class PluginHealthEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    def get(self, request):
        queryset = PluginHealth.objects.all(
            status=ObjectStatus.VISIBLE,
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='name',
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )

    def post(self, request):
        serializer = PluginHealthSerializer(data=request.DATA)

        if serializer.is_valid():
            result = serializer.object

            try:
                with transaction.atomic():
                    plugin_health = PluginHealth.objects.create(
                        name=result['name'],
                        features_list=result.get('features_list'),
                        link=result.get('link'),
                        author=result.get('author'),
                        metadata=result.get('metadata'),
                    )
            except IntegrityError:
                return Response(
                    {
                        'detail': 'A plugin with this name already exists.'
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            return Response(serialize(plugin_health, request.user), status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
