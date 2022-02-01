from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases import NoProjects
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationReplaysPermission

# from sentry.api.helpers.user_reports import user_reports_filter_to_unresolved
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models import ReplaySerializer
from sentry.models.replay import Replay

# from sentry.models import UserReport


class OrganizationReplaysEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationReplaysPermission,)

    def get(self, request: Request, organization) -> Response:
        """
        List an Organization's Replays
        ``````````````````````````````

        Return a list of replay items within this organization. Can be
        filtered by projects/creation date.

        :pparam string organization_slug: the slug of the organization.
        :pparam string project_slug: the slug of the project.
        :auth: required
        """
        try:
            filter_params = self.get_filter_params(request, organization, date_filter_optional=True)
        except NoProjects:
            return Response([])

        queryset = Replay.objects.filter(project_id__in=filter_params["project_id"])
        paginate_kwargs = {}  # TODO (noop right now)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            on_results=lambda x: serialize(x, request.user, ReplaySerializer()),
            paginator_cls=DateTimePaginator,
            **paginate_kwargs,
        )
