from __future__ import annotations

from rest_framework import serializers

from sentry.notebooks.endpoints.validators.base import StrictCamelSnakeValidator


class FavoriteUpdateValidator(StrictCamelSnakeValidator):
    should_favorite = serializers.BooleanField(
        help_text="Whether this investigation is a favorite for the authenticated user."
    )
