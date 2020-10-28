from __future__ import absolute_import

import logging

from rest_framework.response import Response

from sentry import features as feature_flags
from sentry.utils.compat import zip
from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.models import Group
from sentry import similarity


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

        raw_results = {
            group_id: {_fix_label(label): features for label, features in scores.items()}
            for group_id, scores in features.compare(group, limit=limit)
            if group_id != group.id
        }

        fetched_groups = Group.objects.get_many_from_cache(list(raw_results))
        serialized_groups = serialize(fetched_groups, user=request.user)
        group_scores = list(raw_results.pop(group.id) for group in fetched_groups)

        results = list(zip(serialized_groups, group_scores))

        if raw_results:
            # Similarity has returned non-existent group IDs. This can indicate
            # that group deletion is not triggering deletion in similarity, and
            # that we are leaking resources
            logger.error("similarity.api.unknown_group", extra={"group_ids": list(raw_results)})

        return Response(results)
