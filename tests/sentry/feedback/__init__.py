import time
from datetime import UTC, datetime
from unittest.mock import Mock

import pytest
from openai.types.chat.chat_completion import ChatCompletion, Choice
from openai.types.chat.chat_completion_message import ChatCompletionMessage


@pytest.fixture
def mock_produce_occurrence_to_kafka(monkeypatch):
    mock = Mock()
    monkeypatch.setattr(
        "sentry.feedback.usecases.create_feedback.produce_occurrence_to_kafka", mock
    )
    return mock


@pytest.fixture(autouse=True)
def llm_settings(set_sentry_option):
    with (
        set_sentry_option(
            "llm.provider.options",
            {"openai": {"models": ["gpt-4-turbo-1.0"], "options": {"api_key": "fake_api_key"}}},
        ),
        set_sentry_option(
            "llm.usecases.options",
            {"spamdetection": {"provider": "openai", "options": {"model": "gpt-4-turbo-1.0"}}},
        ),
    ):
        yield


def create_dummy_openai_response(*args, **kwargs):
    return ChatCompletion(
        id="test",
        choices=[
            Choice(
                index=0,
                message=ChatCompletionMessage(
                    content=(
                        "spam"
                        if "this is definitely spam"
                        in kwargs["messages"][0][
                            "content"
                        ]  # assume make_input_prompt lower-cases the msg
                        else "not spam"
                    ),
                    role="assistant",
                ),
                finish_reason="stop",
            )
        ],
        created=int(time.time()),
        model="gpt3.5-turbo",
        object="chat.completion",
    )


def mock_feedback_event(project_id: int, dt: datetime | None = None):
    if dt is None:
        dt = datetime.now(UTC)

    return {
        "project_id": project_id,
        "request": {
            "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
            "headers": {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
            },
        },
        "event_id": "56b08cf7852c42cbb95e4a6998c66ad6",
        "timestamp": dt.timestamp(),
        "received": dt.isoformat(),
        "first_seen": dt.isoformat(),
        "environment": "prod",
        "release": "frontend@daf1316f209d961443664cd6eb4231ca154db502",
        "user": {
            "ip_address": "72.164.175.154",
            "email": "josh.ferge@sentry.io",
            "id": 880461,
            "isStaff": False,
            "name": "Josh Ferge",
        },
        "contexts": {
            "feedback": {
                "contact_email": "josh.ferge@sentry.io",
                "name": "Josh Ferge",
                "message": "Testing!!",
                "replay_id": "3d621c61593c4ff9b43f8490a78ae18e",
                "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
            },
        },
        "breadcrumbs": [],
        "platform": "javascript",
    }
