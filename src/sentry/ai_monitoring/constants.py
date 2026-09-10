from sentry.search.events.fields import get_function_alias

AI_CONVERSATIONS_FIELDS = {
    "conversation.conversationId": ("gen_ai.conversation.id", "gen_ai.conversation.id"),
    "conversation.age": ("max(timestamp)", "max(timestamp)"),
    "conversation.duration": (
        "sum_if(`has:gen_ai.operation.type`,span.duration)",
        "duration",
    ),
    "conversation.generationDuration": (
        "sum_if(span.duration,gen_ai.operation.type,equals,ai_client)",
        "generation_duration",
    ),
    "conversation.errors": ("failure_count()", "errors"),
    "conversation.llmCalls": (
        "count_if(gen_ai.operation.type,equals,ai_client)",
        "llm_calls",
    ),
    "conversation.toolCalls": ("count_if(gen_ai.operation.type,equals,tool)", "tool_calls"),
    "conversation.totalTokens": (
        "sum_if(gen_ai.usage.total_tokens,gen_ai.operation.type,equals,ai_client)",
        "total_tokens",
    ),
    "conversation.inputTokens": (
        "sum_if(gen_ai.usage.input_tokens,gen_ai.operation.type,equals,ai_client)",
        "input_tokens",
    ),
    "conversation.outputTokens": (
        "sum_if(gen_ai.usage.output_tokens,gen_ai.operation.type,equals,ai_client)",
        "output_tokens",
    ),
    "conversation.totalCost": (
        "sum_if(gen_ai.cost.total_tokens,gen_ai.operation.type,equals,ai_client)",
        "total_cost",
    ),
    "conversation.toolErrors": (
        "failure_count_if(gen_ai.operation.type,equals,tool)",
        "tool_errors",
    ),
}

# Keep old spellings while frontend and backend deploy independently.
for _field, (_expression, _alias) in tuple(AI_CONVERSATIONS_FIELDS.items()):
    for _legacy_name in (
        _field.removeprefix("conversation."),
        _alias,
        get_function_alias(_expression),
    ):
        AI_CONVERSATIONS_FIELDS[_legacy_name] = (_expression, _alias)
