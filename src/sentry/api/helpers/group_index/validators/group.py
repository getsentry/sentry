from typing import Any, Mapping

from rest_framework import serializers

from sentry.api.fields import ActorField
from sentry.models.actor import Actor
from sentry.models.group import STATUS_UPDATE_CHOICES
from sentry.models.team import Team
from sentry.models.user import User
from sentry.types.group import SUBSTATUS_UPDATE_CHOICES

from . import InboxDetailsValidator, StatusDetailsValidator


class GroupValidator(serializers.Serializer):
    inbox = serializers.BooleanField()
    inboxDetails = InboxDetailsValidator()
    status = serializers.ChoiceField(
        choices=list(zip(STATUS_UPDATE_CHOICES.keys(), STATUS_UPDATE_CHOICES.keys()))
    )
    statusDetails = StatusDetailsValidator()
    substatus = serializers.ChoiceField(
        choices=list(zip(SUBSTATUS_UPDATE_CHOICES.keys(), SUBSTATUS_UPDATE_CHOICES.keys())),
        allow_null=True,
    )
    hasSeen = serializers.BooleanField()
    isBookmarked = serializers.BooleanField()
    isPublic = serializers.BooleanField()
    isSubscribed = serializers.BooleanField()
    merge = serializers.BooleanField()
    discard = serializers.BooleanField()
    ignoreDuration = serializers.IntegerField()
    ignoreCount = serializers.IntegerField()
    # in minutes, max of one week
    ignoreWindow = serializers.IntegerField(max_value=7 * 24 * 60)
    ignoreUserCount = serializers.IntegerField()
    # in minutes, max of one week
    ignoreUserWindow = serializers.IntegerField(max_value=7 * 24 * 60)
    assignedTo = ActorField()

    # TODO(dcramer): remove in 9.0
    # for the moment, the CLI sends this for any issue update, so allow nulls
    snoozeDuration = serializers.IntegerField(allow_null=True)

    def validate_assignedTo(self, value: "Actor") -> "Actor":
        if (
            value
            and value.type is User
            and not self.context["project"].member_set.filter(user_id=value.id).exists()
        ):
            raise serializers.ValidationError("Cannot assign to non-team member")

        if (
            value
            and value.type is Team
            and not self.context["project"].teams.filter(id=value.id).exists()
        ):
            raise serializers.ValidationError(
                "Cannot assign to a team without access to the project"
            )

        return value

    def validate_discard(self, value: bool) -> bool:
        access = self.context.get("access")
        if value and (not access or not access.has_scope("event:admin")):
            raise serializers.ValidationError("You do not have permission to discard events")
        return value

    def validate(self, attrs: Mapping[str, Any]) -> Mapping[str, Any]:
        attrs = super().validate(attrs)
        if len(attrs) > 1 and "discard" in attrs:
            raise serializers.ValidationError("Other attributes cannot be updated when discarding")
        return attrs
