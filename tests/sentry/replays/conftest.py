from collections.abc import Generator
from typing import Any

import pytest
import requests
from django.conf import settings


class ReplayStore:
    def save(self, data: dict[str, Any]) -> None:
        request_url = settings.SENTRY_SNUBA + "/tests/entities/replays/insert"
        response = requests.post(request_url, json=[data])
        assert response.status_code == 200
        return None

    def save_many(self, data: list[dict[str, Any]]) -> None:
        request_url = settings.SENTRY_SNUBA + "/tests/entities/replays/insert"
        response = requests.post(request_url, json=data)
        assert response.status_code == 200


@pytest.fixture
def replay_store() -> Generator[ReplayStore]:
    assert requests.post(settings.SENTRY_SNUBA + "/tests/replays/drop").status_code == 200
    yield ReplayStore()
    assert requests.post(settings.SENTRY_SNUBA + "/tests/replays/drop").status_code == 200
