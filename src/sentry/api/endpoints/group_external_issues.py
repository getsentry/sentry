from __future__ import absolute_import

from rest_framework.response import Response

from sentry import features
from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.models import PlatformExternalIssue


class GroupExternalIssuesEndpoint(GroupEndpoint):
    def get(self, request, group):
        if not features.has('organizations:sentry-apps',
                            group.organization,
                            actor=request.user):
            return Response(status=404)

        external_issues = PlatformExternalIssue.objects.filter(
            group_id=group.id,
        )

        return self.paginate(
            request=request,
            queryset=external_issues,
            order_by='id',
            on_results=lambda x: serialize(x, request.user),
        )
