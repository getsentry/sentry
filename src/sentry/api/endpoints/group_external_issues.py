from __future__ import absolute_import

from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.models import PlatformExternalIssue


class GroupExternalIssuesEndpoint(GroupEndpoint):
    def get(self, request, group):

        external_issues = PlatformExternalIssue.objects.filter(group_id=group.id)

        return self.paginate(
            request=request,
            queryset=external_issues,
            order_by="id",
            on_results=lambda x: serialize(x, request.user),
        )
