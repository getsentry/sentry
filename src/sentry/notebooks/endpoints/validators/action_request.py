from __future__ import annotations

from rest_framework import serializers

from sentry.notebooks.endpoints.validators.base import StrictCamelSnakeValidator


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


class ActionRequestRecheckValidator(StrictCamelSnakeValidator):
    action = serializers.JSONField(
        required=False,
        help_text="The action the user saw. If the request's action is different, the recheck "
        "fails with `action_changed`.",
    )


class ActionRequestRetryFollowUpValidator(StrictCamelSnakeValidator):
    action = serializers.JSONField(
        required=False,
        help_text="The action the user saw. If the request's action is different, the retry "
        "fails with `action_changed`.",
    )
