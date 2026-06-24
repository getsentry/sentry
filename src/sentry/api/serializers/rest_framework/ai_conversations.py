from rest_framework import serializers


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
        # Sorting happens on the paginated "conversation id" query, which groups
        # spans by gen_ai.conversation.id and filters on has:gen_ai.operation.type.
        # Because every gen_ai span is included, the aggregates ordered on there
        # are conversation-wide and consistent with the returned values.
        #
        # toolErrors is intentionally not sortable: it requires a compound
        # condition (gen_ai.operation.type == tool AND a failure span.status),
        # which EAP's count_if aggregate cannot express (single filter only).
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
            "inputTokens",
            "-inputTokens",
            "outputTokens",
            "-outputTokens",
            "totalCost",
            "-totalCost",
        }
        if value not in allowed_sorts:
            raise serializers.ValidationError(f"Invalid sort option: {value}")
        return value
