import logging

from rest_framework.response import Response

from sentry import features as feature_flags
from sentry import similarity
from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.models import Group
from sentry.utils.compat import zip

logger = logging.getLogger(__name__)


def _fix_label(label):
    if isinstance(label, tuple):
        return ":".join(label)
    return label


class GroupSimilarIssuesEndpoint(GroupEndpoint):
    def get(self, request, group):
        version = request.GET.get("version", None)
        if version == "2":
            if not feature_flags.has("projects:similarity-view-v2", group.project):
                return Response({"error": "Project does not have Similarity V2 feature."})

            features = similarity.features2
        elif version in ("1", None):
            features = similarity.features
        else:
            return Response({"error": "Invalid value for version parameter."})

        limit = request.GET.get("limit", None)
        if limit is not None:
            limit = int(limit) + 1  # the target group will always be included

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
            group = serialized_groups.get(group_id)
            if group is None:
                # TODO(tkaemming): This should log when we filter out a group that is
                # unable to be retrieved from the database. (This will soon be
                # unexpected behavior, but still possible.)
                continue

            results.append((group, {_fix_label(k): v for k, v in scores.items()}))

        return Response(results)
