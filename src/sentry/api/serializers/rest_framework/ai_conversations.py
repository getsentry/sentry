from rest_framework import serializers


class OrganizationAIConversationsSerializer(serializers.Serializer):
    sort = serializers.CharField(required=False, default="-timestamp")
    query = serializers.CharField(required=False, allow_blank=True)
    useOptimizedQuery = serializers.BooleanField(required=False, default=False)
    samplingMode = serializers.ChoiceField(
        choices=[
            "NORMAL",
            "HIGHEST_ACCURACY",
            "HIGHEST_ACCURACY_FLEX_TIME",
        ],
        required=False,
        default="HIGHEST_ACCURACY",
    )

    def validate_sort(self, value):
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
        }
        if value not in allowed_sorts:
            raise serializers.ValidationError(f"Invalid sort option: {value}")
        return value
