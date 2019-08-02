from __future__ import absolute_import

from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.api.paginator import DateTimePaginator
from sentry.models import UserReport, Environment
from sentry.api.base import EnvironmentMixin


class GroupUserReportsEndpoint(GroupEndpoint, EnvironmentMixin):
    def get(self, request, group):
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
            report_list = UserReport.objects.filter(group=group)
            if environment is not None:
                report_list = report_list.filter(environment=environment)
        return self.paginate(
            request=request,
            queryset=report_list,
            order_by="-date_added",
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=DateTimePaginator,
        )
