from rest_framework import serializers


class OrganizationAIConversationDetailsSerializer(serializers.Serializer):
    # Version 1 is the historical bare list of spans; version 2 wraps it in an object
    # carrying conversation metadata. Once clients move to 2 it becomes the default and
    # this field goes away.
    apiVersion = serializers.ChoiceField(choices=[1, 2], required=False, default=1)


class OrganizationAIConversationsSerializer(serializers.Serializer):
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
            "toolErrors",
            "-toolErrors",
        }
        if value not in allowed_sorts:
            raise serializers.ValidationError(f"Invalid sort option: {value}")
        return value
