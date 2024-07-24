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
from sentry.discover.models import DatasetSourcesTypes, DiscoverSavedQuery, DiscoverSavedQueryTypes


class DiscoverSavedQueryBase(OrganizationEndpoint):
    owner = ApiOwner.PERFORMANCE
    permission_classes = (DiscoverSavedQueryPermission,)

    def convert_args(self, request: Request, organization_id_or_slug, query_id, *args, **kwargs):
        args, kwargs = super().convert_args(request, organization_id_or_slug, *args, **kwargs)

        try:
            kwargs["query"] = DiscoverSavedQuery.objects.get(
                Q(is_homepage=False) | Q(is_homepage__isnull=True),
                id=query_id,
                organization=kwargs["organization"],
            )
        except DiscoverSavedQuery.DoesNotExist:
            raise ResourceDoesNotExist

        return (args, kwargs)


@region_silo_endpoint
class DiscoverSavedQueryDetailEndpoint(DiscoverSavedQueryBase):
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
        "GET": ApiPublishStatus.UNKNOWN,
        "PUT": ApiPublishStatus.UNKNOWN,
    }

    def has_feature(self, organization, request):
        return features.has(
            "organizations:discover", organization, actor=request.user
        ) or features.has("organizations:discover-query", organization, actor=request.user)

    def get(self, request: Request, organization, query) -> Response:
        """
        Get a saved query
        """
        if not self.has_feature(organization, request):
            return self.respond(status=404)

        self.check_object_permissions(request, query)

        return Response(serialize(query), status=200)

    def put(self, request: Request, organization, query) -> Response:
        """
        Modify a saved query
        """
        if not self.has_feature(organization, request):
            return self.respond(status=404)

        self.check_object_permissions(request, query)

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
        user_selected_dataset = (
            features.has(
                "organizations:performance-discover-dataset-selector",
                organization,
                actor=request.user,
            )
            and data["query_dataset"] != DiscoverSavedQueryTypes.DISCOVER
        )

        query.update(
            organization=organization,
            name=data["name"],
            query=data["query"],
            version=data["version"],
            dataset=data["query_dataset"],
            dataset_source=(
                DatasetSourcesTypes.USER.value
                if user_selected_dataset
                else DatasetSourcesTypes.UNKNOWN.value
            ),
        )

        query.set_projects(data["project_ids"])

        return Response(serialize(query), status=200)

    def delete(self, request: Request, organization, query) -> Response:
        """
        Delete a saved query
        """
        if not self.has_feature(organization, request):
            return self.respond(status=404)

        self.check_object_permissions(request, query)

        query.delete()

        return Response(status=204)


from rest_framework.request import Request
from rest_framework.response import Response


@region_silo_endpoint
class DiscoverSavedQueryVisitEndpoint(DiscoverSavedQueryBase):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def has_feature(self, organization, request):
        return features.has("organizations:discover-query", organization, actor=request.user)

    def post(self, request: Request, organization, query) -> Response:
        """
        Update last_visited and increment visits counter
        """
        if not self.has_feature(organization, request):
            return self.respond(status=404)

        query.visits = F("visits") + 1
        query.last_visited = timezone.now()
        query.save(update_fields=["visits", "last_visited"])

        return Response(status=204)
