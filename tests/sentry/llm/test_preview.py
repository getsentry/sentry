import pytest

from sentry.llm.exceptions import InvalidModelError, InvalidProviderError, InvalidUsecaseError
from sentry.llm.usecases import LLMUseCase, complete_prompt


def _call_complete_prompt(temperature=0.0):
    """Helper function to call complete_prompt with common test parameters."""
    return complete_prompt(
        usecase=LLMUseCase.EXAMPLE,
        prompt="prompt here",
        message="message here",
        temperature=temperature,
        max_output_tokens=1024,
    )


def test_complete_prompt(set_sentry_option) -> None:
    with (
        set_sentry_option("llm.provider.options", {"preview": {"models": ["stub-1.0"]}}),
        set_sentry_option(
            "llm.usecases.options",
            {"example": {"provider": "preview", "options": {"model": "stub-1.0"}}},
        ),
    ):
        res = _call_complete_prompt()

    assert res == ""


def test_invalid_usecase_config(set_sentry_option) -> None:
    with (
        set_sentry_option("llm.provider.options", {"preview": {"models": ["stub-1.0"]}}),
        set_sentry_option(
            "llm.usecases.options",
            {"other": {"provider": "preview", "options": {"model": "stub-1.0"}}},
        ),
    ):
        with pytest.raises(InvalidUsecaseError):
            _call_complete_prompt()


def test_invalid_provider_config(set_sentry_option) -> None:
    with (
        set_sentry_option("llm.provider.options", {"badinput": {"models": ["stub-1.0"]}}),
        set_sentry_option(
            "llm.usecases.options",
            {"example": {"provider": "bad", "options": {"model": "stub-1.0"}}},
        ),
    ):
        with pytest.raises(InvalidProviderError):
            _call_complete_prompt()


def test_invalid_model(set_sentry_option) -> None:
    with (
        set_sentry_option("llm.provider.options", {"preview": {"models": ["stub-1.0"]}}),
        set_sentry_option(
            "llm.usecases.options",
            {"example": {"provider": "preview", "options": {"model": "stub-badmodel"}}},
        ),
    ):
        with pytest.raises(InvalidModelError):
            _call_complete_prompt()


def test_invalid_temperature(set_sentry_option) -> None:
    with (
        set_sentry_option("llm.provider.options", {"preview": {"models": ["stub-1.0"]}}),
        set_sentry_option(
            "llm.usecases.options",
            {"example": {"provider": "preview", "options": {"model": "stub-1.0"}}},
        ),
    ):
        with pytest.raises(ValueError):
            _call_complete_prompt(temperature=-1)
        with pytest.raises(ValueError):
            _call_complete_prompt(temperature=2)
