from __future__ import annotations

from collections.abc import Iterable

from django.db import router, transaction
from django.utils import timezone

from sentry.investigations.models import (
    InvestigationCell,
    InvestigationCellComment,
    InvestigationCellReaction,
    InvestigationCommentReaction,
    InvestigationCommentTeamMention,
    InvestigationCommentUserMention,
    InvestigationStatus,
)
from sentry.investigations.services.investigations import InvestigationValidationError
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.team import Team
from sentry.types.actor import Actor


def validate_mentions(
    *, organization: Organization, mentions: Iterable[Actor]
) -> tuple[list[int], list[int]]:
    user_ids = sorted({actor.id for actor in mentions if actor.is_user})
    team_ids = sorted({actor.id for actor in mentions if actor.is_team})

    valid_user_ids = set(
        OrganizationMember.objects.filter(
            organization=organization,
            user_is_active=True,
            user_id__in=user_ids,
        ).values_list("user_id", flat=True)
    )
    if valid_user_ids != set(user_ids):
        raise InvestigationValidationError(
            {"mentions": "Mentioned users must be active organization members."}
        )
    valid_team_ids = set(
        Team.objects.filter(organization=organization, id__in=team_ids).values_list("id", flat=True)
    )
    if valid_team_ids != set(team_ids):
        raise InvestigationValidationError(
            {"mentions": "Mentioned teams must belong to the organization."}
        )
    return user_ids, team_ids


def _replace_mentions(
    *, comment: InvestigationCellComment, user_ids: list[int], team_ids: list[int]
) -> None:
    InvestigationCommentUserMention.objects.filter(comment=comment).delete()
    InvestigationCommentTeamMention.objects.filter(comment=comment).delete()
    InvestigationCommentUserMention.objects.bulk_create(
        [InvestigationCommentUserMention(comment=comment, user_id=user_id) for user_id in user_ids]
    )
    InvestigationCommentTeamMention.objects.bulk_create(
        [InvestigationCommentTeamMention(comment=comment, team_id=team_id) for team_id in team_ids]
    )


def create_comment(
    *, cell: InvestigationCell, author_id: int, body: str, user_ids: list[int], team_ids: list[int]
) -> InvestigationCellComment:
    if cell.deleted_at is not None or cell.investigation.status != InvestigationStatus.ACTIVE:
        raise InvestigationValidationError({"detail": "This cell is read-only."})
    with transaction.atomic(using=router.db_for_write(InvestigationCellComment)):
        comment = InvestigationCellComment.objects.create(cell=cell, author_id=author_id, body=body)
        _replace_mentions(comment=comment, user_ids=user_ids, team_ids=team_ids)
    return comment


def update_comment(
    *, comment: InvestigationCellComment, body: str, user_ids: list[int], team_ids: list[int]
) -> InvestigationCellComment:
    if (
        comment.deleted_at is not None
        or comment.cell.deleted_at is not None
        or comment.cell.investigation.status != InvestigationStatus.ACTIVE
    ):
        raise InvestigationValidationError({"detail": "This comment is read-only."})
    with transaction.atomic(using=router.db_for_write(InvestigationCellComment)):
        locked = InvestigationCellComment.objects.select_for_update().get(id=comment.id)
        locked.body = body
        locked.save(update_fields=["body", "date_updated"])
        _replace_mentions(comment=locked, user_ids=user_ids, team_ids=team_ids)
    return locked


def delete_comment(comment: InvestigationCellComment) -> None:
    if comment.deleted_at is not None:
        return
    if (
        comment.cell.deleted_at is not None
        or comment.cell.investigation.status != InvestigationStatus.ACTIVE
    ):
        raise InvestigationValidationError({"detail": "This comment is read-only."})
    with transaction.atomic(using=router.db_for_write(InvestigationCellComment)):
        locked = InvestigationCellComment.objects.select_for_update().get(id=comment.id)
        locked.deleted_at = timezone.now()
        locked.save(update_fields=["deleted_at", "date_updated"])
        InvestigationCommentUserMention.objects.filter(comment=locked).delete()
        InvestigationCommentTeamMention.objects.filter(comment=locked).delete()
        InvestigationCommentReaction.objects.filter(comment=locked).delete()


def set_cell_reaction(
    *, cell: InvestigationCell, user_id: int, reaction: str, enabled: bool
) -> None:
    if cell.deleted_at is not None or cell.investigation.status != InvestigationStatus.ACTIVE:
        raise InvestigationValidationError({"detail": "This cell is read-only."})
    if enabled:
        InvestigationCellReaction.objects.get_or_create(
            cell=cell, user_id=user_id, reaction=reaction
        )
    else:
        InvestigationCellReaction.objects.filter(
            cell=cell, user_id=user_id, reaction=reaction
        ).delete()


def set_comment_reaction(
    *, comment: InvestigationCellComment, user_id: int, reaction: str, enabled: bool
) -> None:
    if (
        comment.deleted_at is not None
        or comment.cell.deleted_at is not None
        or comment.cell.investigation.status != InvestigationStatus.ACTIVE
    ):
        raise InvestigationValidationError({"detail": "This comment is read-only."})
    if enabled:
        InvestigationCommentReaction.objects.get_or_create(
            comment=comment, user_id=user_id, reaction=reaction
        )
    else:
        InvestigationCommentReaction.objects.filter(
            comment=comment, user_id=user_id, reaction=reaction
        ).delete()
