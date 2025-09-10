from datetime import UTC, datetime
from typing import Any

from sentry.utils import json


def create_dummy_openai_response(*args: object, **kwargs: Any) -> ChatCompletion:
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


def mock_feedback_event(
    project_id: int, message: str | None = None, dt: datetime | None = None
) -> dict[str, Any]:
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
                "message": message or "Testing!!",
                "replay_id": "3d621c61593c4ff9b43f8490a78ae18e",
                "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
            },
        },
        "breadcrumbs": [],
        "platform": "javascript",
    }


class MockSeerResponse:
    def __init__(self, status: int, json_data: dict):
        self.status = status
        self.json_data = json_data
        self.data = json.dumps(json_data)

    def json(self):
        return self.json_data
