from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import SentryIsAuthenticated
from sentry.api.serializers import serialize
from sentry.api.serializers.models.discoversavedquery import (
    DiscoverSavedQueryModelSerializer,
    DiscoverSavedQueryResponse,
)
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
)
from sentry.apidocs.examples.discover_saved_query_examples import DiscoverExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.auth.principal import RequestPrincipal, is_owned_by_acting_user, require_user
from sentry.discover.endpoints.bases import DiscoverSavedQueryPermission
from sentry.discover.endpoints.serializers import DiscoverHomepageQuerySerializer
from sentry.discover.models import DatasetSourcesTypes, DiscoverSavedQuery, DiscoverSavedQueryTypes
from sentry.models.organization import Organization


def get_homepage_query(organization: Organization, user: RequestPrincipal) -> DiscoverSavedQuery:
    return DiscoverSavedQuery.objects.get(
        is_owned_by_acting_user(user, "created_by_id"), organization=organization, is_homepage=True
    )


@extend_schema(tags=["Discover"])
@cell_silo_endpoint
class DiscoverHomepageQueryEndpoint(OrganizationEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.EXPLORE

    permission_classes = (
        SentryIsAuthenticated,
        DiscoverSavedQueryPermission,
    )

    def has_feature(self, organization: Organization, request: Request) -> bool:
        return features.has("organizations:discover-query", organization, actor=request.user)

    @extend_schema(
        operation_id="getOrganizationDiscoverHomepageQuery",
        summary="Retrieve Your Discover Homepage Query",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=None,
        responses={
            200: DiscoverSavedQueryModelSerializer,
            204: RESPONSE_NO_CONTENT,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=DiscoverExamples.DISCOVER_SAVED_QUERY_GET_RESPONSE,
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[DiscoverSavedQueryResponse] | Response[None]:
        """
        Return the query the requesting user set as their Discover homepage. Returns 204 if
        they haven't set one.
        """
        if not self.has_feature(organization, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        try:
            query = get_homepage_query(organization, request.user)
        except DiscoverSavedQuery.DoesNotExist:
            return Response(status=status.HTTP_204_NO_CONTENT)

        return Response(serialize(query), status=status.HTTP_200_OK)

    @extend_schema(
        operation_id="updateOrganizationDiscoverHomepageQuery",
        summary="Set Your Discover Homepage Query",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=DiscoverHomepageQuerySerializer,
        responses={
            200: DiscoverSavedQueryModelSerializer,
            201: DiscoverSavedQueryModelSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=DiscoverExamples.DISCOVER_SAVED_QUERY_GET_RESPONSE,
    )
    def put(
        self, request: Request, organization: Organization
    ) -> Response[DiscoverSavedQueryResponse] | Response[None]:
        """
        Set the requesting user's Discover homepage query, replacing their current one.
        Returns 201 when the user had no homepage query before, and 200 when it replaced one.
        """
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

        serializer = DiscoverHomepageQuerySerializer(
            data=request.data,
            context={"params": params, "organization": organization, "user": request.user},
        )
        if not serializer.is_valid():
            raise ParseError(serializer.errors)

        data = serializer.validated_data
        user_selected_dataset = data["query_dataset"] != DiscoverSavedQueryTypes.DISCOVER
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
            created_by_id=require_user(request).id,
            is_homepage=True,
        )

        model.set_projects(data["project_ids"])

        return Response(serialize(model), status=status.HTTP_201_CREATED)

    @extend_schema(
        operation_id="deleteOrganizationDiscoverHomepageQuery",
        summary="Clear Your Discover Homepage Query",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=None,
        responses={
            204: RESPONSE_NO_CONTENT,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(self, request: Request, organization: Organization) -> Response[None]:
        """
        Clear the requesting user's Discover homepage query. Returns 404 if they haven't set
        one.
        """
        if not self.has_feature(organization, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        try:
            homepage_query = get_homepage_query(organization, request.user)
        except DiscoverSavedQuery.DoesNotExist:
            raise ResourceDoesNotExist

        homepage_query.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
