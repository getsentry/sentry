import time
from unittest.mock import Mock, patch

import pytest
import responses
from django.test.utils import override_settings
from django.urls import reverse
from openai.types.chat.chat_completion import ChatCompletion, Choice
from openai.types.chat.chat_completion_message import ChatCompletionMessage

from sentry.testutils.cases import APITestCase
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@pytest.fixture(autouse=True)
def openai_features():
    with override_settings(OPENAI_API_KEY="X"):
        yield


@pytest.fixture(autouse=True)
def openai_mock(monkeypatch):
    def dummy_response(*args, **kwargs):
        return ChatCompletion(
            id="test",
            choices=[
                Choice(
                    index=0,
                    message=ChatCompletionMessage(
                        content="AI generated response", role="assistant"
                    ),
                    finish_reason="stop",
                )
            ],
            created=time.time(),
            model="gpt3.5-trubo",
            object="chat.completion",
        )

    mock_openai = Mock()
    mock_openai().chat.completions.create = dummy_response

    monkeypatch.setattr("sentry.api.endpoints.event_ai_suggested_fix.OpenAI", mock_openai)


class EventAiSuggestedFixEndpointTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.event = self.store_event(
            project_id=self.project.id,
            data={
                "exception": {
                    "values": [
                        {
                            "type": "ZeroDivisionError",
                            "stacktrace": {"frames": [{"function": "a"}, {"function": "b"}]},
                        }
                    ]
                }
            },
        )
        self.path = reverse(
            "sentry-api-0-event-ai-fix-suggest",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "event_id": self.event.event_id,
            },
        )
        self.login_as(self.user)

    @responses.activate
    def test_consent(self):
        with patch(
            "sentry.api.endpoints.event_ai_suggested_fix.get_openai_policy",
            return_value="individual_consent",
        ):
            response = self.client.get(self.path)
            assert response.status_code == 403
            assert response.json() == {"restriction": "individual_consent"}
            response = self.client.get(self.path + "?consent=yes")
            assert response.status_code == 200
            assert response.json() == {"suggestion": "AI generated response"}

        with patch(
            "sentry.api.endpoints.event_ai_suggested_fix.get_openai_policy",
            return_value="subprocessor",
        ):
            response = self.client.get(self.path)
            assert response.status_code == 403
            assert response.json() == {"restriction": "subprocessor"}

        with patch(
            "sentry.api.endpoints.event_ai_suggested_fix.get_openai_policy",
            return_value="pii_certification_required",
        ):
            response = self.client.get(self.path)
            assert response.status_code == 403
            assert response.json() == {"restriction": "pii_certification_required"}

        with patch(
            "sentry.api.endpoints.event_ai_suggested_fix.get_openai_policy",
            return_value="allowed",
        ):
            response = self.client.get(self.path)
            assert response.status_code == 200
            assert response.json() == {"suggestion": "AI generated response"}

    def test_describe_event_for_ai(self):
        from sentry.api.endpoints.event_ai_suggested_fix import describe_event_for_ai

        event_data = {
            "exception": {
                "values": [
                    {
                        "type": "ArithmeticError",
                        "value": "division by zero",
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "divide",
                                    "filename": "math_operations.py",
                                    "lineno": 27,
                                    "context_line": "result = 1 / 0",
                                    "pre_context": [
                                        "def divide(x, y):",
                                        "    # Attempt to divide by zero",
                                    ],
                                    "post_context": ["    return result", ""],
                                    "in_app": True,
                                },
                                None,  # Edge case, just to make sure it doesn't break
                                {
                                    "function": "calculate",
                                    "filename": "main.py",
                                    "lineno": 15,
                                    "context_line": "divide(10, 0)",
                                    "pre_context": ["def calculate():", "    # Calculate division"],
                                    "post_context": ["    print('Calculation complete')", ""],
                                    "in_app": True,
                                },
                            ]
                        },
                    }
                ]
            }
        }
        exceptions = describe_event_for_ai(event=event_data, model="gpt-3.5-turbo")
        assert (
            len(exceptions.get("exceptions", [])) == 1
        ), "Should have one exception in the event data"
        exception = exceptions["exceptions"][0]
        assert exception["type"] == "ArithmeticError", "Exception type should be 'ArithmeticError'"
        assert (
            exception["message"] == "division by zero"
        ), "Exception message should be 'division by zero'"
        assert "stacktrace" in exception, "Exception should have a stacktrace"
        assert len(exception["stacktrace"]) == 2, "Stacktrace should have two frames"
        assert (
            exception["stacktrace"][0]["func"] == "calculate"
        ), "First frame function should be 'calculate'"
        assert (
            exception["stacktrace"][1]["func"] == "divide"
        ), "Second frame function should be 'divide'"
