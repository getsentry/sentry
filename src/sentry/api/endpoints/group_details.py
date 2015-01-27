from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.permissions import assert_perm
from sentry.api.serializers import serialize
from sentry.models import Activity, Group, GroupSeen


class GroupDetailsEndpoint(Endpoint):
    def _get_activity(self, request, group, num=7):
        activity_items = set()
        activity = []
        activity_qs = Activity.objects.filter(
            group=group,
        ).order_by('-datetime').select_related('user')
        # we select excess so we can filter dupes
        for item in activity_qs[:num * 2]:
            sig = (item.event_id, item.type, item.ident, item.user_id)
            # TODO: we could just generate a signature (hash(text)) for notes
            # so there's no special casing
            if item.type == Activity.NOTE:
                activity.append(item)
            elif sig not in activity_items:
                activity_items.add(sig)
                activity.append(item)

        activity.append(Activity(
            project=group.project,
            group=group,
            type=Activity.FIRST_SEEN,
            datetime=group.first_seen,
        ))

        return activity[:num]

    def _get_seen_by(self, request, group):
        seen_by = sorted([
            (gs.user, gs.last_seen)
            for gs in GroupSeen.objects.filter(
                group=group
            ).select_related('user')
        ], key=lambda ls: ls[1], reverse=True)
        return [s[0] for s in seen_by]

    def get(self, request, group_id):
        group = Group.objects.get(
            id=group_id,
        )

        assert_perm(group, request.user, request.auth)

        data = serialize(group, request.user)

        # TODO: these probably should be another endpoint
        activity = self._get_activity(request, group, num=7)
        seen_by = self._get_seen_by(request, group)

        data.update({
            'activity': serialize(activity, request.user),
            'seenBy': serialize(seen_by, request.user),
        })

        return Response(data)
