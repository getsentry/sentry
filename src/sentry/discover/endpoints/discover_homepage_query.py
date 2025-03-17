from rest_framework import status
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import SentryIsAuthenticated
from sentry.api.serializers import serialize
from sentry.discover.endpoints.bases import DiscoverSavedQueryPermission
from sentry.discover.endpoints.serializers import DiscoverSavedQuerySerializer
from sentry.discover.models import DatasetSourcesTypes, DiscoverSavedQuery, DiscoverSavedQueryTypes


def get_homepage_query(organization, user):
    return DiscoverSavedQuery.objects.get(
        organization=organization, is_homepage=True, created_by_id=user.id
    )


@region_silo_endpoint
class DiscoverHomepageQueryEndpoint(OrganizationEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.PERFORMANCE

    permission_classes = (
        SentryIsAuthenticated,
        DiscoverSavedQueryPermission,
    )

    def has_feature(self, organization, request):
        return features.has(
            "organizations:discover", organization, actor=request.user
        ) or features.has("organizations:discover-query", organization, actor=request.user)

    def get(self, request: Request, organization) -> Response:
        if not self.has_feature(organization, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        try:
            query = get_homepage_query(organization, request.user)
        except DiscoverSavedQuery.DoesNotExist:
            return Response(status=status.HTTP_204_NO_CONTENT)

        return Response(serialize(query), status=status.HTTP_200_OK)

    def put(self, request: Request, organization) -> Response:
        if not self.has_feature(organization, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        try:
            previous_homepage = get_homepage_query(organization, request.user)
        except DiscoverSavedQuery.DoesNotExist:
            previous_homepage = None

        try:
            params = self.get_filter_params(
                request, organization, project_ids=request.data.get("projects")
            )
        except NoProjects:
            raise ParseError(detail="No Projects found, join a Team")

        serializer = DiscoverSavedQuerySerializer(
            # HACK: To ensure serializer data is valid, pass along a name temporarily
            data={**request.data, "name": "New Query"},
            context={"params": params, "organization": organization, "user": request.user},
        )
        if not serializer.is_valid():
            raise ParseError(serializer.errors)

        data = serializer.validated_data
        user_selected_dataset = (
            features.has(
                "organizations:performance-discover-dataset-selector",
                organization,
                actor=request.user,
            )
            and data["query_dataset"] != DiscoverSavedQueryTypes.DISCOVER
        )
        if previous_homepage:
            previous_homepage.update(
                organization=organization,
                name="",
                query=data["query"],
                version=data["version"],
                dataset=data["query_dataset"],
                dataset_source=(
                    DatasetSourcesTypes.USER.value
                    if user_selected_dataset
                    else DatasetSourcesTypes.UNKNOWN.value
                ),
            )
            previous_homepage.set_projects(data["project_ids"])
            return Response(serialize(previous_homepage), status=status.HTTP_200_OK)

        model = DiscoverSavedQuery.objects.create(
            organization=organization,
            name="",
            query=data["query"],
            version=data["version"],
            dataset=data["query_dataset"],
            dataset_source=(
                DatasetSourcesTypes.USER.value
                if user_selected_dataset
                else DatasetSourcesTypes.UNKNOWN.value
            ),
            created_by_id=request.user.id,
            is_homepage=True,
        )

        model.set_projects(data["project_ids"])

        return Response(serialize(model), status=status.HTTP_201_CREATED)

    def delete(self, request: Request, organization) -> Response:
        if not self.has_feature(organization, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        try:
            homepage_query = get_homepage_query(organization, request.user)
        except DiscoverSavedQuery.DoesNotExist:
            raise ResourceDoesNotExist

        homepage_query.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
