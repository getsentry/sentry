from rest_framework.request import Request

from sentry.api.base import customer_silo_endpoint
from sentry.api.bases import OrganizationIssuesEndpoint
from sentry.models import Group


@customer_silo_endpoint
class OrganizationMemberIssuesViewedEndpoint(OrganizationIssuesEndpoint):
    def get_queryset(self, request: Request, organization, member, project_list):
        return (
            Group.objects.filter(groupseen__user=member.user, groupseen__project__in=project_list)
            .extra(select={"sort_by": "sentry_groupseen.last_seen"})
            .order_by("-sort_by")
        )
