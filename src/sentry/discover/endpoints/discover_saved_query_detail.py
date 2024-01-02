from django.db.models import F, Q
from django.utils import timezone
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
from sentry.discover.endpoints.bases import DiscoverSavedQueryPermission
from sentry.discover.endpoints.serializers import DiscoverSavedQuerySerializer
from sentry.discover.models import DiscoverSavedQuery


@region_silo_endpoint
class DiscoverSavedQueryDetailEndpoint(OrganizationEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
        "GET": ApiPublishStatus.UNKNOWN,
        "PUT": ApiPublishStatus.UNKNOWN,
    }
    owner = ApiOwner.DISCOVER_N_DASHBOARDS
    permission_classes = (DiscoverSavedQueryPermission,)

    def has_feature(self, organization, request):
        return features.has(
            "organizations:discover", organization, actor=request.user
        ) or features.has("organizations:discover-query", organization, actor=request.user)

    def get(self, request: Request, organization, query_id) -> Response:
        """
        Get a saved query
        """
        if not self.has_feature(organization, request):
            return self.respond(status=404)

        try:
            query = DiscoverSavedQuery.objects.get(
                Q(is_homepage=False) | Q(is_homepage__isnull=True),
                id=query_id,
                organization=organization,
            )
        except DiscoverSavedQuery.DoesNotExist:
            raise ResourceDoesNotExist

        return Response(serialize(query), status=200)

    def put(self, request: Request, organization, query_id) -> Response:
        """
        Modify a saved query
        """
        if not self.has_feature(organization, request):
            return self.respond(status=404)

        try:
            model = DiscoverSavedQuery.objects.get(
                Q(is_homepage=False) | Q(is_homepage__isnull=True),
                id=query_id,
                organization=organization,
            )
        except DiscoverSavedQuery.DoesNotExist:
            raise ResourceDoesNotExist

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
            return Response(serializer.errors, status=400)

        data = serializer.validated_data
        model.update(
            organization=organization,
            name=data["name"],
            query=data["query"],
            version=data["version"],
        )

        model.set_projects(data["project_ids"])

        return Response(serialize(model), status=200)

    def delete(self, request: Request, organization, query_id) -> Response:
        """
        Delete a saved query
        """
        if not self.has_feature(organization, request):
            return self.respond(status=404)

        try:
            model = DiscoverSavedQuery.objects.get(
                Q(is_homepage=False) | Q(is_homepage__isnull=True),
                id=query_id,
                organization=organization,
            )
        except DiscoverSavedQuery.DoesNotExist:
            raise ResourceDoesNotExist

        model.delete()

        return Response(status=204)


from rest_framework.request import Request
from rest_framework.response import Response


@region_silo_endpoint
class DiscoverSavedQueryVisitEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.DISCOVER_N_DASHBOARDS
    permission_classes = (DiscoverSavedQueryPermission,)

    def has_feature(self, organization, request):
        return features.has("organizations:discover-query", organization, actor=request.user)

    def post(self, request: Request, organization, query_id) -> Response:
        """
        Update last_visited and increment visits counter
        """
        if not self.has_feature(organization, request):
            return self.respond(status=404)

        try:
            model = DiscoverSavedQuery.objects.get(
                Q(is_homepage=False) | Q(is_homepage__isnull=True),
                id=query_id,
                organization=organization,
            )
        except DiscoverSavedQuery.DoesNotExist:
            raise ResourceDoesNotExist

        model.visits = F("visits") + 1
        model.last_visited = timezone.now()
        model.save(update_fields=["visits", "last_visited"])

        return Response(status=204)
