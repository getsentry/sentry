from typing import Literal, Required, TypedDict

AI_OPERATION_TYPE_VALUE = Literal["agent", "ai_client", "tool", "handoff"]

# Default catch all "*" -> ai_client mapping is defined explicitly in the code
# so it doesn't take precedence over other mappings, while ai_client mappings
# must be listed first to ensure they take precedence over less strict "agent"
# mappings. (e.g. "ai.streamText.doStream*" -> ai_client, "ai.streamText*" -> agent)
AI_OPERATION_TYPE_MAP: dict[AI_OPERATION_TYPE_VALUE, list[str]] = {
    "ai_client": [
        "ai.streamText.doStream*",
        "ai.generateText.doGenerate*",
    ],
    "agent": [
        "ai.run.generateText",
        "ai.run.generateObject",
        "gen_ai.invoke_agent",
        "ai.pipeline.generate_text",
        "ai.pipeline.generate_object",
        "ai.pipeline.stream_text",
        "ai.pipeline.stream_object",
        "gen_ai.create_agent",
        "invoke_agent",
        "create_agent",
        "ai.streamText*",
        "ai.generateText*",
    ],
    "tool": ["gen_ai.execute_tool", "execute_tool", "ai.toolCall*"],
    "handoff": ["gen_ai.handoff", "handoff"],
}


class AIOperationTypeMap(TypedDict):
    version: Required[int]
    operationTypes: Required[dict[str, AI_OPERATION_TYPE_VALUE]]


def ai_operation_type_map_config() -> AIOperationTypeMap:
    operation_type_map = {}
    # creates reverse map from operation to operation type
    for operation_type, operations in AI_OPERATION_TYPE_MAP.items():
        for operation in operations:
            operation_type_map[operation] = operation_type

    # default catch all "*" -> ai_client mapping
    # at the end of the map to ensure it doesn't
    # takes precedence over other mappings
    operation_type_map["*"] = "ai_client"

    return {
        "version": 1,
        "operationTypes": operation_type_map,
    }
