from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.serializers import serialize, StreamGroupSerializer
from sentry.api.paginator import DateTimePaginator
from sentry.models import Group, GroupStatus, OrganizationMemberTeam, Project

from .organizationmember import OrganizationMemberEndpoint

ERR_INVALID_STATS_PERIOD = "Invalid stats_period. Valid choices are '', '24h', and '14d'"


class OrganizationIssuesEndpoint(OrganizationMemberEndpoint):
    def get_queryset(self, request, organization, member):
        # Must return a 'sorty_by' selector for pagination that is a datetime
        return Group.objects.none()

    def get(self, request, organization, member):
        """
        Return a list of issues assigned to the given member.
        """
        stats_period = request.GET.get('statsPeriod')
        if stats_period not in (None, '', '24h', '14d'):
            return Response({"detail": ERR_INVALID_STATS_PERIOD}, status=400)
        elif stats_period is None:
            # default
            stats_period = '24h'
        elif stats_period == '':
            # disable stats
            stats_period = None

        project_list = Project.objects.filter(
            organization=organization,
            team__in=OrganizationMemberTeam.objects.filter(
                organizationmember=member,
                is_active=True,
            ).values('team')
        )

        queryset = self.get_queryset(request, organization, member, project_list)
        status = request.GET.get('status', 'unresolved')
        if status == 'unresolved':
            queryset = queryset.filter(
                status=GroupStatus.UNRESOLVED,
            )
        elif status:
            return Response({'status': 'Invalid status choice'}, status=400)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='-sort_by',
            paginator_cls=DateTimePaginator,
            on_results=lambda x: serialize(x, request.user, StreamGroupSerializer(
                stats_period=stats_period,
            )),
        )
