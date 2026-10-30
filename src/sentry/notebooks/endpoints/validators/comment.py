from __future__ import annotations

from typing import Any

from rest_framework import serializers

from sentry.notebooks.endpoints.base import InvestigationArchivedError
from sentry.notebooks.endpoints.validators.base import StrictCamelSnakeValidator
from sentry.notebooks.models import NotebookBlock, NotebookComment, NotebookStatus

MAX_COMMENT_LENGTH = 10_000


class CommentListValidator(serializers.Serializer[None]):
    """Query parameters. Not strict, because pagination adds its own parameters."""

    blockId = serializers.IntegerField(
        min_value=1,
        required=False,
        help_text="Only return comments attached to this block. Omit to return all investigation comments.",
    )


class CommentValidator(StrictCamelSnakeValidator[NotebookComment]):
    body = serializers.CharField(
        max_length=MAX_COMMENT_LENGTH, help_text="Comment text, up to 10,000 characters."
    )

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if self.context["investigation"].status == NotebookStatus.ARCHIVED:
            raise InvestigationArchivedError
        return attrs


class CommentCreateValidator(CommentValidator):
    block_id = serializers.IntegerField(
        min_value=1,
        required=False,
        help_text="Attach the comment to an active block in this investigation. Omit for an investigation-level comment.",
    )

    def validate_block_id(self, value: int) -> NotebookBlock:
        block = NotebookBlock.objects.filter(
            id=value, notebook=self.context["investigation"], deleted_at__isnull=True
        ).first()
        if block is None:
            raise serializers.ValidationError("Block not found.")
        return block

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        attrs = super().validate(attrs)
        if "block_id" in attrs:
            attrs["block"] = attrs.pop("block_id")
        return attrs

    def create(self, validated_data: dict[str, Any]) -> NotebookComment:
        return NotebookComment.objects.create(
            notebook=self.context["investigation"], **validated_data
        )


class CommentUpdateValidator(CommentValidator):
    def update(self, instance: NotebookComment, validated_data: dict[str, Any]) -> NotebookComment:
        instance.update(**validated_data)
        return instance
