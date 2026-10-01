from __future__ import annotations

from typing import Any

from rest_framework import serializers

from sentry.investigations.endpoints.base import InvestigationArchivedError
from sentry.investigations.endpoints.validators.base import StrictCamelSnakeValidator
from sentry.investigations.models import (
    InvestigationBlock,
    InvestigationComment,
    InvestigationStatus,
)

MAX_COMMENT_LENGTH = 10_000


class CommentListValidator(serializers.Serializer[None]):
    """Query parameters. Not strict, because pagination adds its own parameters."""

    blockId = serializers.IntegerField(min_value=1, required=False)


class CommentValidator(StrictCamelSnakeValidator[InvestigationComment]):
    body = serializers.CharField(max_length=MAX_COMMENT_LENGTH)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if self.context["investigation"].status == InvestigationStatus.ARCHIVED:
            raise InvestigationArchivedError
        return attrs


class CommentCreateValidator(CommentValidator):
    block_id = serializers.IntegerField(min_value=1, required=False)

    def validate_block_id(self, value: int) -> InvestigationBlock:
        block = InvestigationBlock.objects.filter(
            id=value, investigation=self.context["investigation"], deleted_at__isnull=True
        ).first()
        if block is None:
            raise serializers.ValidationError("Block not found.")
        return block

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        attrs = super().validate(attrs)
        if "block_id" in attrs:
            attrs["block"] = attrs.pop("block_id")
        return attrs

    def create(self, validated_data: dict[str, Any]) -> InvestigationComment:
        return InvestigationComment.objects.create(
            investigation=self.context["investigation"], **validated_data
        )


class CommentUpdateValidator(CommentValidator):
    def update(
        self, instance: InvestigationComment, validated_data: dict[str, Any]
    ) -> InvestigationComment:
        instance.update(**validated_data)
        return instance
