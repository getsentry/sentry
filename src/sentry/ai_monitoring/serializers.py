from typing import NotRequired, TypedDict

from rest_framework import serializers

from sentry.search.events.types import SAMPLING_MODES


class AIConversationsQuery(TypedDict):
    sort: str
    query: NotRequired[str]
    samplingMode: SAMPLING_MODES


class OrganizationAIConversationsSerializer(serializers.Serializer[AIConversationsQuery]):
    sort = serializers.CharField(required=False, default="-timestamp")
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

    def validate_sort(self, value: str) -> str:
        allowed_sorts = {
            "timestamp",
            "-timestamp",
            "duration",
            "-duration",
            "errors",
            "-errors",
            "llmCalls",
            "-llmCalls",
            "toolCalls",
            "-toolCalls",
            "totalTokens",
            "-totalTokens",
            "totalCost",
            "-totalCost",
            "toolErrors",
            "-toolErrors",
        }
        if value not in allowed_sorts:
            raise serializers.ValidationError(f"Invalid sort option: {value}")
        return value
