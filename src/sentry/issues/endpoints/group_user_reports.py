from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.helpers.deprecation import deprecated
from sentry.api.helpers.environments import get_environment
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize
from sentry.constants import CELL_API_DEPRECATION_DATE
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.models.environment import Environment
from sentry.models.userreport import UserReport


@region_silo_endpoint
class GroupUserReportsEndpoint(GroupEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    @deprecated(CELL_API_DEPRECATION_DATE, url_names=["sentry-api-0-group-user-reports"])
    def get(self, request: Request, group) -> Response:
        """
        List User Reports
        `````````````````

        Returns a list of user reports for an issue.

        :pparam string issue_id: the ID of the issue to retrieve.
        :pparam string key: the tag key to look the values up for.
        :auth: required
        """

        try:
            environment = get_environment(request, group.organization.id)
        except Environment.DoesNotExist:
            report_list = UserReport.objects.none()
        else:
            report_list = UserReport.objects.filter(group_id=group.id)
            if environment is not None:
                report_list = report_list.filter(environment_id=environment.id)
        return self.paginate(
            request=request,
            queryset=report_list,
            order_by="-date_added",
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=DateTimePaginator,
        )
