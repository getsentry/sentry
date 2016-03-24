from __future__ import absolute_import

from sentry.api.bases import OrganizationMemberEndpoint
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize, OrganizationActivitySerializer
from sentry.models import Activity, OrganizationMemberTeam, Project


class OrganizationActivityEndpoint(OrganizationMemberEndpoint):
    def get(self, request, organization, member):
        queryset = Activity.objects.filter(
            project__in=Project.objects.filter(
                organization=organization,
                team__in=OrganizationMemberTeam.objects.filter(
                    organizationmember=member,
                ).values('team')
            )
        ).select_related('project', 'group', 'user')

        return self.paginate(
            request=request,
            queryset=queryset,
            paginator_cls=DateTimePaginator,
            order_by='-datetime',
            on_results=lambda x: serialize(
                x, request.user, OrganizationActivitySerializer()
            ),
        )
