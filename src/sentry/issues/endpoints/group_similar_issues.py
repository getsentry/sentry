import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import similarity
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.models.group import Group

logger = logging.getLogger(__name__)


def _fix_label(label) -> str:
    if isinstance(label, tuple):
        return ":".join(label)
    return label


@region_silo_endpoint
class GroupSimilarIssuesEndpoint(GroupEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, group: Group) -> Response:
        features = similarity.features

        limit_s = request.GET.get("limit", None)
        if limit_s is not None:
            limit: int | None = int(limit_s) + 1  # the target group will always be included
        else:
            limit = None

        group_ids = []
        group_scores = []

        for group_id, scores in features.compare(group, limit=limit):
            if group_id != group.id:
                group_ids.append(group_id)
                group_scores.append(scores)

        serialized_groups = {
            int(g["id"]): g
            for g in serialize(
                list(Group.objects.get_many_from_cache(group_ids)), user=request.user
            )
        }

        results = []

        # We need to preserve the ordering of the Redis results, as that
        # ordering is directly shown in the UI
        for group_id, scores in zip(group_ids, group_scores):
            serialized_group = serialized_groups.get(group_id)
            if serialized_group is None:
                # TODO(tkaemming): This should log when we filter out a group that is
                # unable to be retrieved from the database. (This will soon be
                # unexpected behavior, but still possible.)
                continue

            results.append((serialized_group, {_fix_label(k): v for k, v in scores.items()}))

        return Response(results)
