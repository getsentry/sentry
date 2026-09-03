from drf_spectacular.utils import OpenApiExample


class AIConversationExamples:
    LIST_AI_CONVERSATIONS = [
        OpenApiExample(
            "Return a list of AI conversations",
            value=[
                {
                    "conversationId": "01JQZ4W8X7J2Q9B4R5M6N7P8T9",
                    "title": "Weather assistant",
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
