from __future__ import absolute_import

from sentry.api.bases import OrganizationIssuesEndpoint
from sentry.models import Group


class OrganizationMemberIssuesViewedEndpoint(OrganizationIssuesEndpoint):
    def get_queryset(self, request, organization, member, project_list):
        return (
            Group.objects.filter(groupseen__user=member.user, groupseen__project__in=project_list)
            .extra(select={"sort_by": "sentry_groupseen.last_seen"})
            .order_by("-sort_by")
        )
