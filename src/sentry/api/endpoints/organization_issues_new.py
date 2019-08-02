from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone

from sentry.api.bases import OrganizationIssuesEndpoint
from sentry.models import Group, GroupStatus


class OrganizationIssuesNewEndpoint(OrganizationIssuesEndpoint):
    def get_queryset(self, request, organization, member, project_list):
        cutoff = timezone.now() - timedelta(days=7)

        return (
            Group.objects.filter(
                status=GroupStatus.UNRESOLVED, active_at__gte=cutoff, project__in=project_list
            )
            .extra(select={"sort_by": "sentry_groupedmessage.first_seen"})
            .select_related("project")
            .order_by("-sort_by")
        )
