from typing import Literal, Required, TypedDict

AI_OPERATION_TYPE_VALUE = Literal["agent", "ai_client", "tool", "handoff"]

AI_OPERATION_TYPE_MAP: dict[AI_OPERATION_TYPE_VALUE, list[str]] = {
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
    "ai_client": ["*"],  # default fallback
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

    return {
        "version": 1,
        "operationTypes": operation_type_map,
    }
