from __future__ import annotations

from rest_framework import serializers

from sentry.notebooks.presence import DEFAULT_VIEWER_LIMIT, MAX_VIEWER_LIMIT


class PresenceValidator(serializers.Serializer[None]):
    """Query parameters of the presence heartbeat."""

    limit = serializers.IntegerField(
        min_value=1,
        max_value=MAX_VIEWER_LIMIT,
        default=DEFAULT_VIEWER_LIMIT,
        help_text="Maximum other viewers to return, from 1 to 50. Defaults to 20.",
    )
