from sentry.ai_monitoring.conversation_aggregates import CONVERSATION_AGGREGATE_DEFINITIONS
from sentry.search.events.fields import get_function_alias

AI_CONVERSATIONS_FIELDS = {
    "conversation.conversationId": ("gen_ai.conversation.id", "gen_ai.conversation.id"),
    "conversation.age": ("max(timestamp)", "max(timestamp)"),
    "conversation.duration": (
        "sum_if(`has:gen_ai.operation.type`,span.duration)",
        "duration",
    ),
    "conversation.errors": ("failure_count()", "errors"),
    "conversation.generationDuration": CONVERSATION_AGGREGATE_DEFINITIONS["generationDuration"],
    "conversation.inputTokens": CONVERSATION_AGGREGATE_DEFINITIONS["inputTokens"],
    "conversation.llmCalls": CONVERSATION_AGGREGATE_DEFINITIONS["llmCalls"],
    "conversation.outputTokens": CONVERSATION_AGGREGATE_DEFINITIONS["outputTokens"],
    "conversation.toolCalls": CONVERSATION_AGGREGATE_DEFINITIONS["toolCalls"],
    "conversation.toolErrors": CONVERSATION_AGGREGATE_DEFINITIONS["toolErrors"],
    "conversation.totalCost": CONVERSATION_AGGREGATE_DEFINITIONS["totalCost"],
    "conversation.totalTokens": CONVERSATION_AGGREGATE_DEFINITIONS["totalTokens"],
}

AI_CONVERSATIONS_LEGACY_ALIASES = {
    "conversation.messages": "conversation.llmCalls",
}

# Keep old spellings while frontend and backend deploy independently.
for _field, (_expression, _alias) in tuple(AI_CONVERSATIONS_FIELDS.items()):
    for _legacy_name in (
        _field.removeprefix("conversation."),
        _alias,
        get_function_alias(_expression),
    ):
        AI_CONVERSATIONS_FIELDS[_legacy_name] = (_expression, _alias)

for _legacy_name, _canonical_name in AI_CONVERSATIONS_LEGACY_ALIASES.items():
    AI_CONVERSATIONS_FIELDS[_legacy_name] = AI_CONVERSATIONS_FIELDS[_canonical_name]
