from rest_framework.response import Response

from sentry.api.base import EnvironmentMixin
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import StreamGroupSerializer, serialize
from sentry.models import Group, GroupStatus, OrganizationMemberTeam, Project, ProjectStatus

from .organizationmember import OrganizationMemberEndpoint

ERR_INVALID_STATS_PERIOD = "Invalid stats_period. Valid choices are '', '24h', and '14d'"


class OrganizationIssuesEndpoint(OrganizationMemberEndpoint, EnvironmentMixin):
    def get_queryset(self, request, organization, member, project_list):
        # Must return a 'sort_by' selector for pagination that is a datetime
        return Group.objects.none()

    def get(self, request, organization, member):
        """
        Return a list of issues assigned to the given member.
        """
        stats_period = request.GET.get("statsPeriod")
        if stats_period not in (None, "", "24h", "14d"):
            return Response({"detail": ERR_INVALID_STATS_PERIOD}, status=400)
        elif stats_period is None:
            # default
            stats_period = "24h"
        elif stats_period == "":
            # disable stats
            stats_period = None

        project_list = Project.objects.filter(
            organization=organization,
            teams__in=OrganizationMemberTeam.objects.filter(organizationmember=member).values(
                "team"
            ),
        )

        queryset = self.get_queryset(request, organization, member, project_list)
        status = request.GET.get("status", "unresolved")
        if status == "unresolved":
            queryset = queryset.filter(status=GroupStatus.UNRESOLVED)
        elif status:
            return Response({"status": "Invalid status choice"}, status=400)

        # hide issues if the project is pending removal
        queryset = queryset.filter(project__status=ProjectStatus.VISIBLE)

        def on_results(results):
            results = serialize(
                results,
                request.user,
                StreamGroupSerializer(
                    environment_func=self._get_environment_func(request, organization.id),
                    stats_period=stats_period,
                ),
            )

            if request.GET.get("status") == "unresolved":
                results = [r for r in results if r["status"] == "unresolved"]

            return results

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-sort_by",
            paginator_cls=OffsetPaginator,
            on_results=on_results,
        )
