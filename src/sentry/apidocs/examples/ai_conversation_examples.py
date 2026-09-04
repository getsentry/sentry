from drf_spectacular.utils import OpenApiExample


class AIConversationExamples:
    RETRIEVE_AI_CONVERSATION = [
        OpenApiExample(
            "Return an AI conversation",
            value={
                "conversationId": "01JQZ4W8X7J2Q9B4R5M6N7P8T9",
                "title": "Check San Francisco weather",
                "spans": [
                    {
                        "span_id": "a1b2c3d4e5f67890",
                        "trace": "4c79f60c11214eb38604f4ae0781bfb2",
                        "parent_span": None,
                        "precise.start_ts": 1743465600.0,
                        "precise.finish_ts": 1743465601.25,
                        "project": "weather-assistant",
                        "project.id": 1,
                        "span.op": "gen_ai.chat",
                        "span.status": "ok",
                        "span.description": "chat gpt-4o-mini",
                        "span.duration": 1250.0,
                        "transaction": "weather-agent",
                        "is_transaction": False,
                        "gen_ai.conversation.id": "01JQZ4W8X7J2Q9B4R5M6N7P8T9",
                        "gen_ai.operation.type": "ai_client",
                        "gen_ai.request.model": "gpt-4o-mini",
                        "gen_ai.response.model": "gpt-4o-mini-2024-07-18",
                        "gen_ai.request.messages": '[{"role":"user","content":"What is the weather in San Francisco?"}]',
                        "gen_ai.response.text": "It is currently 18°C and sunny in San Francisco.",
                        "gen_ai.usage.total_tokens": 485,
                        "gen_ai.cost.total_tokens": 0.0042,
                        "user.id": "123",
                        "user.email": "user@example.com",
                        "errors": [],
                        "occurrences": [],
                    }
                ],
            },
            response_only=True,
            status_codes=["200"],
        )
    ]

    LIST_AI_CONVERSATIONS = [
        OpenApiExample(
            "Return a list of AI conversations",
            value=[
                {
                    "conversationId": "01JQZ4W8X7J2Q9B4R5M6N7P8T9",
                    "title": "Check San Francisco weather",
                    "projectId": 1,
                    "flow": ["Weather Assistant"],
                    "errors": 0,
                    "llmCalls": 2,
                    "toolCalls": 1,
                    "totalTokens": 485,
                    "inputTokens": 320,
                    "outputTokens": 165,
                    "totalCost": 0.0042,
                    "generationDuration": 1250.5,
                    "startTimestamp": 1743465600000,
                    "endTimestamp": 1743465602500,
                    "traceCount": 1,
                    "traceIds": ["4c79f60c11214eb38604f4ae0781bfb2"],
                    "firstInput": "What is the weather in San Francisco?",
                    "lastOutput": "It is currently 18°C and sunny in San Francisco.",
                    "user": {
                        "id": "123",
                        "email": "user@example.com",
                        "username": "example-user",
                        "ip_address": "192.0.2.1",
                    },
                    "toolNames": ["get_weather"],
                    "toolErrors": 0,
                }
            ],
            response_only=True,
            status_codes=["200"],
        )
    ]
