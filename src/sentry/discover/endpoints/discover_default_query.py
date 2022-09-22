from rest_framework import status
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import pending_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.discover.endpoints.bases import DiscoverSavedQueryPermission
from sentry.discover.endpoints.serializers import DiscoverSavedQuerySerializer
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
            return Response({}, status=status.HTTP_200_OK)

        return Response(serialize(query), status=status.HTTP_200_OK)

    def put(self, request: Request, organization) -> Response:
        previous_default = DiscoverSavedQuery.objects.get(
            is_default=True, organization=organization, created_by=request.user
        )

        try:
            params = self.get_filter_params(
                request, organization, project_ids=request.data.get("projects")
            )
        except NoProjects:
            raise ParseError(detail="No Projects found, join a Team")

        serializer = DiscoverSavedQuerySerializer(
            data=request.data,
            context={"params": params},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        previous_default.update(
            organization=organization,
            name=data["name"],
            query=data["query"],
            version=data["version"],
        )

        return Response(status=status.HTTP_200_OK)
