from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationUserReportsPermission
from sentry.api.bases import NoProjects
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models import UserReportWithGroupSerializer
from sentry.models import GroupStatus, UserReport
from sentry.utils.apidocs import attach_scenarios, scenario


@scenario("ListOrganizationUserReports")
def list_org_user_reports_scenario(runner):
    runner.request(method="GET", path="/organizations/%s/user-feedback/" % (runner.org.slug,))


class OrganizationUserReportsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationUserReportsPermission,)

    @attach_scenarios([list_org_user_reports_scenario])
    def get(self, request, organization):
        """
        List an Organization's User Feedback
        ``````````````````````````````

        Return a list of user feedback items within this organization. Can be
        filtered by projects/environments/creation date.

        :pparam string organization_slug: the slug of the organization.
        :pparam string project_slug: the slug of the project.
        :auth: required
        """
        try:
            filter_params = self.get_filter_params(request, organization, date_filter_optional=True)
        except NoProjects:
            return Response([])

        queryset = UserReport.objects.filter(
            project_id__in=filter_params["project_id"], group__isnull=False
        ).select_related("group")
        if "environment" in filter_params:
            queryset = queryset.filter(environment__name__in=filter_params["environment"])
        if filter_params["start"] and filter_params["end"]:
            queryset = queryset.filter(
                date_added__range=(filter_params["start"], filter_params["end"])
            )

        status = request.GET.get("status", "unresolved")
        if status == "unresolved":
            queryset = queryset.filter(group__status=GroupStatus.UNRESOLVED)
        elif status:
            return self.respond({"status": "Invalid status choice"}, status=400)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            on_results=lambda x: serialize(x, request.user, UserReportWithGroupSerializer()),
            paginator_cls=DateTimePaginator,
        )
