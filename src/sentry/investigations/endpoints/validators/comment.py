from __future__ import annotations

from rest_framework import serializers


class CommentListValidator(serializers.Serializer[None]):
    """Query parameters. Not strict, because pagination adds its own parameters."""

    blockId = serializers.IntegerField(min_value=1, required=False)
