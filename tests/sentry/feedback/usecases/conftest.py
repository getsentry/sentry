from collections.abc import Callable, Generator
from typing import Any
from unittest import mock

import pytest


@pytest.fixture
def mock_produce_occurrence_to_kafka() -> Generator[mock.MagicMock]:
    with mock.patch(
        "sentry.feedback.usecases.ingest.create_feedback.produce_occurrence_to_kafka"
    ) as mck:
        yield mck


@pytest.fixture(autouse=True)
def llm_settings(
    set_sentry_option: Callable[[str, dict[str, dict[str, Any]]], Any],
) -> Generator[None]:
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
