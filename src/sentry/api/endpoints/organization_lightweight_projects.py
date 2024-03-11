from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases.organization import OrganizationAndStaffPermission, OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.project import LightWeightProjectSerializer
from sentry.models.project import Project


@region_silo_endpoint
class OrganizationLightweightProjectsEndpoint(OrganizationEndpoint, EnvironmentMixin):
    # this is for the UI only
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationAndStaffPermission,)
    owner = ApiOwner.UNOWNED

    def get(self, request: Request, organization) -> Response:
        """
        Return projects for an organization. Only return a subset of project fields
        that are needed for rendering our application well.
        """
        queryset = Project.objects.filter(organization=organization)

        def serialize_on_result(result):
            serializer = LightWeightProjectSerializer()
            return serialize(result, request.user, serializer)

        return self.paginate(
            request=request,
            queryset=queryset,
            count_hits=True,
            on_results=serialize_on_result,
            paginator_cls=OffsetPaginator,
        )
