from typing import int, Any

import pytest
import requests
from django.conf import settings


class ReplayStore:

    def save(self, data: dict[str, Any]) -> None:
        request_url = settings.SENTRY_SNUBA + "/tests/entities/replays/insert"
        response = requests.post(request_url, json=[data])
        assert response.status_code == 200
        return None


@pytest.fixture
def replay_store() -> ReplayStore:
    assert requests.post(settings.SENTRY_SNUBA + "/tests/replays/drop").status_code == 200
    return ReplayStore()
