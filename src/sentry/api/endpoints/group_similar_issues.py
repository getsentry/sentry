from __future__ import absolute_import

import functools

from rest_framework.response import Response

from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.models import Group
from sentry.similarity import features
from sentry.utils.functional import apply_values


class GroupSimilarIssuesEndpoint(GroupEndpoint):
    def get(self, request, group):
        # TODO(tkaemming): This should have a limit somewhere.
        results = filter(
            lambda (group_id, scores): group_id != group.id,
            features.compare(group)
        )

        serialized_groups = apply_values(
            functools.partial(serialize, user=request.user),
            Group.objects.in_bulk([group_id for group_id, scores in results])
        )

        # TODO(tkaemming): This should log when we filter out a group that is
        # unable to be retrieved from the database. (This will soon be
        # unexpected behavior, but still possible.)
        return Response(
            filter(
                lambda (group_id, scores): group_id is not None,
                map(
                    lambda (group_id, scores): (serialized_groups.get(group_id), scores, ),
                    results,
                ),
            ),
        )
