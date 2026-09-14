from typing import NotRequired, TypedDict

from rest_framework import serializers

from sentry.ai_monitoring.constants import AI_CONVERSATIONS_FIELDS
from sentry.search.events.types import SAMPLING_MODES


class AIConversationsQuery(TypedDict):
    sort: list[str]
    query: NotRequired[str]
    samplingMode: SAMPLING_MODES


class OrganizationAIConversationsSerializer(serializers.Serializer[AIConversationsQuery]):
    sort = serializers.ListField(
        child=serializers.CharField(), required=False, default=["-conversation.age"]
    )
    query = serializers.CharField(required=False, allow_blank=True)
    samplingMode = serializers.ChoiceField(
        choices=[
            "NORMAL",
            "HIGHEST_ACCURACY",
            "HIGHEST_ACCURACY_FLEX_TIME",
        ],
        required=False,
        default="HIGHEST_ACCURACY",
    )

    def validate_sort(self, value: list[str]) -> list[str]:
        if self.context.get("sorting_enabled") and len(value) != 1:
            raise serializers.ValidationError("Provide exactly one sort option.")
        for sort in value:
            if sort.removeprefix("-") not in AI_CONVERSATIONS_FIELDS:
                raise serializers.ValidationError(f"Invalid sort option: {sort}")
        return value
