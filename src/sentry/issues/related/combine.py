from collections.abc import Mapping

from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import BaseGroupSerializerResponse
from sentry.issues.related.types import (
    RelatedIssueRelation,
    RelatedIssuesContext,
    RelatedIssuesResponse,
    RelationType,
    RelationTypeResult,
    RelationTypeStatus,
)
from sentry.models.group import Group


def combine(
    ctx: RelatedIssuesContext, results: Mapping[RelationType, RelationTypeResult]
) -> RelatedIssuesResponse:
    """
    Build the response from each type's result. An issue found by several types becomes one entry
    with a relation for each, and issues matched by more types come first.
    """
    relations_by_group: dict[int, list[RelatedIssueRelation]] = {}
    for result in results.values():
        if result.meta["status"] != RelationTypeStatus.OK:
            continue
        for group_id, relation in result.relations.items():
            relations_by_group.setdefault(group_id, []).append(relation)
    ordered_group_ids = sorted(relations_by_group, key=lambda gid: -len(relations_by_group[gid]))

    # Scoped to the organization in case a type's lookup ever returns an ID from outside it. Deleted
    # groups drop out here.
    groups = Group.objects.filter(
        id__in=relations_by_group, project__organization_id=ctx.group.project.organization_id
    )
    serialized: dict[int, BaseGroupSerializerResponse] = {
        int(g["id"]): g for g in serialize(list(groups), user=ctx.user)
    }

    return {
        "data": [
            {"issue": serialized[group_id], "relations": relations_by_group[group_id]}
            for group_id in ordered_group_ids
            if group_id in serialized
        ],
        "meta": {
            "types": [result.meta for result in results.values()],
        },
    }
