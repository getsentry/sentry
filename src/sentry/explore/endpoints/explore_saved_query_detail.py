from django.db.models import F
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.exploresavedquery import ExploreSavedQueryModelSerializer
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
)
from sentry.apidocs.examples.explore_saved_query_examples import ExploreExamples
from sentry.apidocs.parameters import ExploreSavedQueryParams, GlobalParams
from sentry.explore.endpoints.bases import ExploreSavedQueryPermission
from sentry.explore.endpoints.serializers import ExploreSavedQuerySerializer
from sentry.explore.models import ExploreSavedQuery, ExploreSavedQueryLastVisited


class ExploreSavedQueryBase(OrganizationEndpoint):
    owner = ApiOwner.PERFORMANCE
    permission_classes = (ExploreSavedQueryPermission,)

    def convert_args(self, request: Request, organization_id_or_slug, id, *args, **kwargs):
        args, kwargs = super().convert_args(request, organization_id_or_slug, *args, **kwargs)

        try:
            kwargs["query"] = ExploreSavedQuery.objects.get(
                id=id,
                organization=kwargs["organization"],
            )
        except ExploreSavedQuery.DoesNotExist:
            raise ResourceDoesNotExist

        return (args, kwargs)


@extend_schema(tags=["Discover"])
@region_silo_endpoint
class ExploreSavedQueryDetailEndpoint(ExploreSavedQueryBase):
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }

    def has_feature(self, organization, request):
        return features.has(
            "organizations:visibility-explore-view", organization, actor=request.user
        )

    @extend_schema(
        operation_id="Retrieve an Organization's Explore Saved Query",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            ExploreSavedQueryParams.EXPLORE_SAVED_QUERY_ID,
        ],
        request=None,
        responses={
            200: ExploreSavedQueryModelSerializer,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ExploreExamples.EXPLORE_SAVED_QUERY_GET_RESPONSE,
    )
    def get(self, request: Request, organization, query) -> Response:
        """
        Retrieve a saved query.
        """
        if not self.has_feature(organization, request):
            return self.respond(status=404)

        self.check_object_permissions(request, query)

        return Response(serialize(query, request.user), status=200)

    @extend_schema(
        operation_id="Edit an Organization's Explore Saved Query",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, ExploreSavedQueryParams.EXPLORE_SAVED_QUERY_ID],
        request=ExploreSavedQuerySerializer,
        responses={
            200: ExploreSavedQueryModelSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ExploreExamples.EXPLORE_SAVED_QUERY_GET_RESPONSE,
    )
    def put(self, request: Request, organization, query) -> Response:
        """
        Modify a saved query.
        """
        if not self.has_feature(organization, request):
            return self.respond(status=404)

        self.check_object_permissions(request, query)

        if query.prebuilt_id is not None:
            return self.respond(status=400, message="Cannot modify prebuilt queries")

        try:
            params = self.get_filter_params(
                request, organization, project_ids=request.data.get("projects")
            )
        except NoProjects:
            raise ParseError(detail="No Projects found, join a Team")

        serializer = ExploreSavedQuerySerializer(
            data=request.data,
            context={"params": params, "organization": organization, "user": request.user},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data

        query.update(
            organization=organization,
            name=data["name"],
            query=data["query"],
        )

        query.set_projects(data["project_ids"])

        return Response(serialize(query), status=200)

    @extend_schema(
        operation_id="Delete an Organization's Explore Saved Query",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, ExploreSavedQueryParams.EXPLORE_SAVED_QUERY_ID],
        responses={
            204: RESPONSE_NO_CONTENT,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(self, request: Request, organization, query) -> Response:
        """
        Delete a saved query.
        """
        if not self.has_feature(organization, request):
            return self.respond(status=404)

        self.check_object_permissions(request, query)

        if query.prebuilt_id is not None:
            return self.respond(status=400, message="Cannot delete prebuilt queries")

        query.delete()

        return Response(status=204)


@region_silo_endpoint
class ExploreSavedQueryVisitEndpoint(ExploreSavedQueryBase):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def has_feature(self, organization, request):
        return features.has(
            "organizations:visibility-explore-view", organization, actor=request.user
        )

    def post(self, request: Request, organization, query) -> Response:
        """
        Update last_visited and increment visits counter
        """
        if not self.has_feature(organization, request):
            return self.respond(status=404)

        query.visits = F("visits") + 1
        query.last_visited = timezone.now()
        query.save(update_fields=["visits", "last_visited"])

        ExploreSavedQueryLastVisited.objects.create_or_update(
            organization=organization,
            user_id=request.user.id,
            explore_saved_query=query,
            values={"last_visited": timezone.now()},
        )

        return Response(status=204)
