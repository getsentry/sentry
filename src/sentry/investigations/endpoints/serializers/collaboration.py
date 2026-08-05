from __future__ import annotations

from collections import Counter
from typing import Any

from django.db.models import Prefetch, QuerySet

from sentry.investigations.models import (
    InvestigationBlockComment,
    InvestigationCommentReaction,
    InvestigationCommentTeamMention,
    InvestigationCommentUserMention,
    InvestigationReaction,
)


def serialize_reactions(reactions: Any, user_id: int) -> list[dict[str, Any]]:
    values = (
        [(reaction.reaction, reaction.user_id) for reaction in reactions]
        if isinstance(reactions, list)
        else list(reactions.values_list("reaction", "user_id"))
    )
    counts = Counter(reaction for reaction, _ in values)
    mine = {reaction for reaction, reaction_user_id in values if reaction_user_id == user_id}
    return [
        {"reaction": reaction, "count": counts[reaction], "reactedByMe": reaction in mine}
        for reaction in InvestigationReaction.values
        if reaction in counts
    ]


def serialize_comment(comment: InvestigationBlockComment, *, user_id: int) -> dict[str, Any]:
    mentions = [
        {"type": "user", "id": str(mention.user_id)}
        for mention in getattr(
            comment,
            "serialized_user_mentions",
            comment.user_mentions.order_by("user_id"),
        )
    ] + [
        {"type": "team", "id": str(mention.team_id)}
        for mention in getattr(
            comment,
            "serialized_team_mentions",
            comment.team_mentions.order_by("team_id"),
        )
    ]
    return {
        "id": str(comment.id),
        "body": None if comment.deleted_at is not None else comment.body,
        "author": str(comment.author_id) if comment.author_id is not None else None,
        "dateCreated": comment.date_added,
        "dateUpdated": comment.date_updated,
        "deletedAt": comment.deleted_at,
        "mentions": [] if comment.deleted_at is not None else mentions,
        "reactions": serialize_reactions(
            getattr(comment, "serialized_reactions", comment.reactions), user_id
        ),
    }


def comments_with_serialization_data(
    queryset: QuerySet[InvestigationBlockComment],
) -> QuerySet[InvestigationBlockComment]:
    return queryset.prefetch_related(
        Prefetch(
            "user_mentions",
            queryset=InvestigationCommentUserMention.objects.order_by("user_id"),
            to_attr="serialized_user_mentions",
        ),
        Prefetch(
            "team_mentions",
            queryset=InvestigationCommentTeamMention.objects.order_by("team_id"),
            to_attr="serialized_team_mentions",
        ),
        Prefetch(
            "reactions",
            queryset=InvestigationCommentReaction.objects.order_by("id"),
            to_attr="serialized_reactions",
        ),
    )
