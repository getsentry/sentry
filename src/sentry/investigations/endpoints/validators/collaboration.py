from __future__ import annotations

from rest_framework import serializers

from sentry.api.fields.actor import ActorField
from sentry.investigations.endpoints.validators.base import StrictCamelSnakeValidator


class CommentValidator(StrictCamelSnakeValidator):
    body = serializers.CharField(max_length=10_000, trim_whitespace=False)
    mentions = serializers.ListField(child=ActorField(), required=False)

    def validate_body(self, value: str) -> str:
        if not value.strip():
            raise serializers.ValidationError("Comment body cannot be empty.")
        return value
