from collections.abc import Mapping
from typing import Any

from rest_framework import serializers

from sentry.api.fields.actor import ActorField
from sentry.api.helpers.group_index.validators.inbox_details import InboxDetailsValidator
from sentry.api.helpers.group_index.validators.status_details import StatusDetailsValidator
from sentry.models.group import STATUS_UPDATE_CHOICES, Group
from sentry.types.actor import Actor
from sentry.types.group import SUBSTATUS_UPDATE_CHOICES, PriorityLevel


class GroupValidator(serializers.Serializer[Group]):
    inbox = serializers.BooleanField(
        required=False, help_text="If true, marks the issue as reviewed by the requestor."
    )
    status = serializers.ChoiceField(
        required=False,
        help_text="The new status for the issues.",
        choices=list(zip(STATUS_UPDATE_CHOICES.keys(), STATUS_UPDATE_CHOICES.keys())),
    )
    statusDetails = StatusDetailsValidator(
        required=False,
        help_text="Additional details about the resolution. Status detail updates that include release data are only allowed for issues within a single project.",
    )
    substatus = serializers.ChoiceField(
        required=False,
        choices=list(zip(SUBSTATUS_UPDATE_CHOICES.keys(), SUBSTATUS_UPDATE_CHOICES.keys())),
        allow_null=True,
        help_text="The new substatus of the issue.",
    )
    hasSeen = serializers.BooleanField(
        required=False, help_text="If true, marks the issue as seen by the requestor."
    )
    isBookmarked = serializers.BooleanField(
        required=False, help_text="If true, bookmarks the issue for the requestor."
    )
    isPublic = serializers.BooleanField(required=False, help_text="If true, publishes the issue.")
    isSubscribed = serializers.BooleanField(
        required=False, help_text="If true, subscribes the requestor to the issue."
    )
    merge = serializers.BooleanField(
        required=False, help_text="If true, merges the issues together."
    )
    discard = serializers.BooleanField(
        required=False, help_text="If true, discards the issues instead of updating them."
    )
    assignedTo = ActorField(
        required=False,
        help_text="The user or team that should be assigned to the issues. Values take the form of `<user_id>`, `user:<user_id>`, `<username>`, `<user_primary_email>`, or `team:<team_id>`.",
    )
    priority = serializers.ChoiceField(
        required=False,
        help_text="The priority that should be set for the issues",
        choices=list(
            zip(
                [p.to_str() for p in PriorityLevel],
                [p.to_str() for p in PriorityLevel],
            )
        ),
    )

    ####################################################
    # These fields are not documented in the API docs. #
    ####################################################
    # These are already covered by the `statusDetails` serializer field.
    ignoreDuration = serializers.IntegerField(
        required=False,
        min_value=0,
        help_text="Ignore the issue for this many minutes.",
    )
    ignoreCount = serializers.IntegerField(
        required=False,
        min_value=0,
        help_text="Ignore the issue until it is seen this many more times.",
    )
    ignoreWindow = serializers.IntegerField(
        required=False,
        min_value=0,
        max_value=7 * 24 * 60,
        help_text="Window in minutes over which `ignoreCount` is measured. Maximum is 7 days.",
    )
    ignoreUserCount = serializers.IntegerField(
        required=False,
        min_value=0,
        help_text="Ignore the issue until it affects this many more users.",
    )
    ignoreUserWindow = serializers.IntegerField(
        required=False,
        min_value=0,
        max_value=7 * 24 * 60,
        help_text="Window in minutes over which `ignoreUserCount` is measured. Maximum is 7 days.",
    )
    # The `inboxDetails`` field is empty.
    inboxDetails = InboxDetailsValidator(
        required=False,
        help_text="Details recorded when the issue is moved out of the inbox.",
    )
    # The `snooze` field is deprecated.
    # TODO(dcramer): remove in 9.0
    # for the moment, the CLI sends this for any issue update, so allow nulls
    snoozeDuration = serializers.IntegerField(
        required=False,
        allow_null=True,
        min_value=0,
        help_text="Snooze the issue for this many minutes.",
    )

    def validate_assignedTo(self, value: Actor | None) -> Actor | None:
        if not value:
            return value

        organization = self.context.get("organization")
        if organization and organization.flags.allow_joinleave:
            return value

        if (
            value.is_user
            and not self.context["project"].member_set.filter(user_id=value.id).exists()
        ):
            raise serializers.ValidationError("Cannot assign to non-team member")

        if value.is_team and not self.context["project"].teams.filter(id=value.id).exists():
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
