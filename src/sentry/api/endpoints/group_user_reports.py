from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize
from sentry.models.environment import Environment
from sentry.models.userreport import UserReport


@region_silo_endpoint
class GroupUserReportsEndpoint(GroupEndpoint, EnvironmentMixin):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

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
            environment = self._get_environment_from_request(request, group.organization.id)
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
