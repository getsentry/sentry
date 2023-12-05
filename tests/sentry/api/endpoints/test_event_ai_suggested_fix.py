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
def test_consent(client, default_project, test_event, openai_policy):
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

    openai_policy["result"] = "allowed"
    response = client.get(path)
    assert response.status_code == 200
    assert response.json() == {"suggestion": "AI generated response"}
