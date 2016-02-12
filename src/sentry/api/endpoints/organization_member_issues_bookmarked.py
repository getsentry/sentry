from __future__ import absolute_import

from sentry.api.bases import OrganizationIssuesEndpoint
from sentry.models import Group


class OrganizationMemberIssuesBookmarkedEndpoint(OrganizationIssuesEndpoint):
    def get_queryset(self, request, organization, member, project_list):
        return Group.objects.filter(
            bookmark_set__user=member.user,
            bookmark_set__project__in=project_list,
        ).extra(
            select={'sort_by': 'sentry_groupbookmark.date_added'},
        ).order_by('-sort_by')
