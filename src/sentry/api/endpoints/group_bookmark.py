from __future__ import absolute_import

from sentry.api.base import Endpoint
from sentry.api.permissions import assert_perm
from sentry.models import Group, GroupBookmark

from rest_framework.response import Response


class GroupBookmarkEndpoint(Endpoint):
    def post(self, request, group_id):
        group = Group.objects.get(
            id=group_id,
        )

        assert_perm(group, request.user, request.auth)

        bookmark = GroupBookmark(
            project=group.project,
            group=group,
            user=request.user,
        )

        bookmark.save()

        return Response()
