from collections.abc import Mapping
from typing import Any

from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers

from sentry.api.fields.actor import OwnerActorField
from sentry.api.helpers.group_index.validators.inbox_details import InboxDetailsValidator
from sentry.api.helpers.group_index.validators.status_details import StatusDetailsValidator
from sentry.models.group import STATUS_UPDATE_CHOICES, Group
from sentry.types.actor import Actor
from sentry.types.group import SUBSTATUS_UPDATE_CHOICES, PriorityLevel


@extend_schema_serializer(
    exclude_fields=[
        "ignoreDuration",
        "ignoreCount",
        "ignoreWindow",
        "ignoreUserCount",
        "ignoreUserWindow",
        "inboxDetails",
        "snoozeDuration",
    ]
)
class GroupValidator(serializers.Serializer[Group]):
    inbox = serializers.BooleanField(
        help_text="If true, marks the issue as reviewed by the requestor."
    )
    status = serializers.ChoiceField(
        help_text="Limit mutations to only issues with the given status.",
        choices=list(zip(STATUS_UPDATE_CHOICES.keys(), STATUS_UPDATE_CHOICES.keys())),
    )
    statusDetails = StatusDetailsValidator(
        help_text="Additional details about the resolution. Status detail updates that include release data are only allowed for issues within a single project."
    )
    substatus = serializers.ChoiceField(
        choices=list(zip(SUBSTATUS_UPDATE_CHOICES.keys(), SUBSTATUS_UPDATE_CHOICES.keys())),
        allow_null=True,
        help_text="The new substatus of the issue.",
    )
    hasSeen = serializers.BooleanField(
        help_text="If true, marks the issue as seen by the requestor."
    )
    isBookmarked = serializers.BooleanField(
        help_text="If true, bookmarks the issue for the requestor."
    )
    isPublic = serializers.BooleanField(help_text="If true, publishes the issue.")
    isSubscribed = serializers.BooleanField(
        help_text="If true, subscribes the requestor to the issue."
    )
    merge = serializers.BooleanField(help_text="If true, merges the issues together.")
    discard = serializers.BooleanField(
        help_text="If true, discards the issues instead of updating them."
    )
    assignedTo = OwnerActorField(
        help_text="The user or team that should be assigned to the issues. Values take the form of `<user_id>`, `user:<user_id>`, `<username>`, `<user_primary_email>`, or `team:<team_id>`."
    )
    priority = serializers.ChoiceField(
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
    ignoreDuration = serializers.IntegerField()
    ignoreCount = serializers.IntegerField()
    ignoreWindow = serializers.IntegerField(max_value=7 * 24 * 60)
    ignoreUserCount = serializers.IntegerField()
    ignoreUserWindow = serializers.IntegerField(max_value=7 * 24 * 60)
    # The `inboxDetails`` field is empty.
    inboxDetails = InboxDetailsValidator()
    # The `snooze` field is deprecated.
    # TODO(dcramer): remove in 9.0
    # for the moment, the CLI sends this for any issue update, so allow nulls
    snoozeDuration = serializers.IntegerField(allow_null=True)

    def validate_assignedTo(self, value: Actor) -> Actor:
        if (
            value
            and value.is_user
            and not self.context["project"].member_set.filter(user_id=value.id).exists()
        ):
            raise serializers.ValidationError("Cannot assign to non-team member")

        if (
            value
            and value.is_team
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
