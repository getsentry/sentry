from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import pending_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.discover.endpoints.bases import DiscoverSavedQueryPermission
from sentry.discover.models import DiscoverSavedQuery


@pending_silo_endpoint
class DiscoverDefaultQueryEndpoint(OrganizationEndpoint):
    permission_classes = (DiscoverSavedQueryPermission,)

    def has_feature(self, organization, request):
        return features.has(
            "organizations:discover", organization, actor=request.user
        ) or features.has("organizations:discover-query", organization, actor=request.user)

    def get(self, request: Request, organization) -> Response:
        try:
            query = DiscoverSavedQuery.objects.get(
                organization=organization, is_default=True, created_by=request.user
            )
        except DiscoverSavedQuery.DoesNotExist:
            return Response({}, status=200)

        return Response(serialize(query), status=200)

    def put(self, request: Request, organization) -> Response:
        # use create or update
        pass
