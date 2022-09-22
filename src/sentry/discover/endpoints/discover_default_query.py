from rest_framework import status
from rest_framework.exceptions import ParseError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import pending_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.discover.endpoints.bases import DiscoverSavedQueryPermission
from sentry.discover.endpoints.serializers import DiscoverSavedQuerySerializer
from sentry.discover.models import DiscoverSavedQuery


def get_default_query(organization, user):
    return DiscoverSavedQuery.objects.get(
        organization=organization, is_default=True, created_by=user
    )


@pending_silo_endpoint
class DiscoverDefaultQueryEndpoint(OrganizationEndpoint):
    private = True

    permission_classes = (
        IsAuthenticated,
        DiscoverSavedQueryPermission,
    )

    def has_feature(self, organization, request):
        return (
            features.has("organizations:discover", organization, actor=request.user)
            or features.has("organizations:discover-query", organization, actor=request.user)
        ) and features.has(
            "organizations:discover-query-builder-as-landing-page", organization, actor=request.user
        )

    def get(self, request: Request, organization) -> Response:
        if not self.has_feature(organization, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        try:
            query = get_default_query(organization, request.user)
        except DiscoverSavedQuery.DoesNotExist:
            return Response({}, status=status.HTTP_200_OK)

        return Response(serialize(query), status=status.HTTP_200_OK)

    def put(self, request: Request, organization) -> Response:
        if not self.has_feature(organization, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        try:
            previous_default = get_default_query(organization, request.user)
        except DiscoverSavedQuery.DoesNotExist:
            previous_default = None

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
        if previous_default:
            previous_default.update(
                organization=organization,
                name=data["name"],
                query=data["query"],
                version=data["version"],
            )
            return Response(status=status.HTTP_204_NO_CONTENT)

        model = DiscoverSavedQuery.objects.create(
            organization=organization,
            name=data["name"],
            query=data["query"],
            version=data["version"],
            created_by=request.user,
            is_default=True,
        )

        model.set_projects(data["project_ids"])

        return Response(status=status.HTTP_201_CREATED)

    def delete(self, request: Request, organization) -> Response:
        if not self.has_feature(organization, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        try:
            default_query = get_default_query(organization, request.user)
        except DiscoverSavedQuery.DoesNotExist:
            raise ResourceDoesNotExist

        default_query.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
