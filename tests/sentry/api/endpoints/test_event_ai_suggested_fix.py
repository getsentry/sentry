import time
from unittest.mock import Mock

import pytest
from django.test.utils import override_settings
from django.urls import reverse
from openai.types.chat.chat_completion import ChatCompletion, Choice
from openai.types.chat.chat_completion_message import ChatCompletionMessage

from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@pytest.fixture(autouse=True)
def openai_features():
    with override_settings(OPENAI_API_KEY="X"):
        yield


@pytest.fixture(autouse=True)
def auto_login(client, default_user):
    assert client.login(username=default_user.username, password="admin")


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


@pytest.fixture
def test_event(default_project, factories):
    event_data = {
        "exception": {
            "values": [
                {
                    "type": "ZeroDivisionError",
                    "stacktrace": {"frames": [{"function": f} for f in ["a", "b"]]},
                }
            ]
        }
    }
    return factories.store_event(data=event_data, project_id=default_project.id)


@pytest.fixture
def openai_policy():
    from sentry.api.endpoints.event_ai_suggested_fix import openai_policy_check

    data = {"result": "allowed"}

    def policy(sender, **kwargs):
        return data["result"]

    try:
        openai_policy_check.connect(policy)
        yield data
    finally:
        openai_policy_check.disconnect(policy)


@django_db_all
def test_consent(client, monkeypatch, default_project, test_event, openai_policy):
    path = reverse(
        "sentry-api-0-event-ai-fix-suggest",
        kwargs={
            "organization_slug": default_project.organization.slug,
            "project_slug": default_project.slug,
            "event_id": test_event.event_id,
        },
    )

    openai_policy["result"] = "individual_consent"
    response = client.get(path)
    assert response.status_code == 403
    assert response.json() == {"restriction": "individual_consent"}
    response = client.get(path + "?consent=yes")
    assert response.status_code == 200
    assert response.json() == {"suggestion": "AI generated response"}

    openai_policy["result"] = "subprocessor"
    response = client.get(path)
    assert response.status_code == 403
    assert response.json() == {"restriction": "subprocessor"}

    with monkeypatch.context() as m:
        m.setattr(client.user, "is_staff", True)
        openai_policy["result"] = "pii_certification_required"
        response = client.get(path)
        assert response.status_code == 403
        assert response.json() == {"restriction": "pii_certification_required"}

    openai_policy["result"] = "allowed"
    response = client.get(path)
    assert response.status_code == 200
    assert response.json() == {"suggestion": "AI generated response"}


@django_db_all
def test_describe_event_for_ai(client, default_project, test_event, openai_policy):
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
    assert len(exceptions.get("exceptions", [])) == 1, "Should have one exception in the event data"
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
