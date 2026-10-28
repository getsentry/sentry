from __future__ import annotations

from rest_framework import serializers

from sentry.investigations.endpoints.validators.base import StrictCamelSnakeValidator


class ActionRequestApplyValidator(StrictCamelSnakeValidator):
    dry_run = serializers.BooleanField(
        default=False,
        help_text="Run every check without applying, to see whether the apply would work.",
    )
    action = serializers.JSONField(
        required=False,
        help_text="The action the user saw. If the request's action is different, the apply fails "
        "with `action_changed`.",
    )
