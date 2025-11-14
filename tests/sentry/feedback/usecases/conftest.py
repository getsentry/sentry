from typing import int
from collections.abc import Generator
from unittest import mock

import pytest


@pytest.fixture
def mock_produce_occurrence_to_kafka() -> Generator[mock.MagicMock]:
    with mock.patch(
        "sentry.feedback.usecases.ingest.create_feedback.produce_occurrence_to_kafka"
    ) as mck:
        yield mck
