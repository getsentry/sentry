from __future__ import absolute_import

from sentry.api.bases import OrganizationIssuesEndpoint
from sentry.models import Group
from django.db.models import Q


class OrganizationMemberIssuesAssignedEndpoint(OrganizationIssuesEndpoint):
    def get_queryset(self, request, organization, member, project_list):
        return Group.objects.filter(
            Q(assignee_set__user=member.user, assignee_set__project__in=project_list) |
            Q(assignee_set__team__in=member.get_teams())
        ).extra(
            select={'sort_by': 'sentry_groupasignee.date_added'},
        ).order_by('-sort_by')
