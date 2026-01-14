from sentry.testutils.cases import APITestCase, BaseSpansTestCase, SpanTestCase
from sentry.utils import json

LLM_TOKENS = 100
LLM_COST = 0.001


class BaseAIConversationsTestCase(BaseSpansTestCase, SpanTestCase, APITestCase):
    """Base test class for AI conversations-related endpoint tests.

    Provides common utilities for creating AI span test data.
    """

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def store_ai_span(
        self,
        conversation_id,
        timestamp,
        op="gen_ai.chat",
        description=None,
        status="ok",
        operation_type=None,
        tokens=None,
        cost=None,
        trace_id=None,
        agent_name=None,
        messages=None,
        response_text=None,
        user_id=None,
        user_email=None,
        user_username=None,
        user_ip=None,
    ):
        """Create and store an AI span with the given attributes.

        Args:
            conversation_id: The gen_ai.conversation.id attribute
            timestamp: The span start timestamp
            op: The span operation (default: "gen_ai.chat")
            description: Span description
            status: Span status (default: "ok")
            operation_type: The gen_ai.operation.type attribute
            tokens: Token count (gen_ai.usage.total_tokens)
            cost: Cost (gen_ai.cost.total_tokens)
            trace_id: The trace ID for the span
            agent_name: The gen_ai.agent.name attribute
            messages: The gen_ai.request.messages (will be JSON serialized)
            response_text: The gen_ai.response.text attribute
            user_id: User ID (sentry.user.id)
            user_email: User email (sentry.user.email)
            user_username: User username (sentry.user.username)
            user_ip: User IP address (sentry.user.ip)

        Returns:
            The created span object
        """
        span_data = {"gen_ai.conversation.id": conversation_id}
        if operation_type:
            span_data["gen_ai.operation.type"] = operation_type
        if tokens is not None:
            span_data["gen_ai.usage.total_tokens"] = tokens
        if cost is not None:
            span_data["gen_ai.cost.total_tokens"] = cost
        if agent_name is not None:
            span_data["gen_ai.agent.name"] = agent_name
        if messages is not None:
            # Serialize as JSON string since test infrastructure doesn't support list attributes
            span_data["gen_ai.request.messages"] = json.dumps(messages)
        if response_text is not None:
            span_data["gen_ai.response.text"] = response_text
        # Store user data with sentry. prefix for EAP indexing
        if user_id is not None:
            span_data["sentry.user.id"] = user_id
        if user_email is not None:
            span_data["sentry.user.email"] = user_email
        if user_username is not None:
            span_data["sentry.user.username"] = user_username
        if user_ip is not None:
            span_data["sentry.user.ip"] = user_ip

        extra_data = {
            "description": description or "default",
            "sentry_tags": {"status": status, "op": op},
            "data": span_data,
        }
        if trace_id:
            extra_data["trace_id"] = trace_id

        span = self.create_span(
            extra_data,
            start_ts=timestamp,
        )
        self.store_spans([span], is_eap=True)
        return span
