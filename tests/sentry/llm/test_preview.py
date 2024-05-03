import pytest

from sentry.llm.exceptions import InvalidModelError, InvalidProviderError, InvalidUsecaseError
from sentry.llm.usecases import LLMUseCase, complete_prompt


def test_complete_prompt(set_sentry_option):
    with (
        set_sentry_option("llm.provider.options", {"preview": {"models": ["stub-1.0"]}}),
        set_sentry_option(
            "llm.usecases.options",
            {"example": {"provider": "preview", "options": {"model": "stub-1.0"}}},
        ),
    ):
        res = complete_prompt(
            usecase=LLMUseCase.EXAMPLE,
            prompt="prompt here",
            message="message here",
            temperature=0.0,
            max_output_tokens=1024,
        )

    assert res == ""


def test_invalid_usecase_config(set_sentry_option):
    with (
        set_sentry_option("llm.provider.options", {"preview": {"models": ["stub-1.0"]}}),
        set_sentry_option(
            "llm.usecases.options",
            {"other": {"provider": "preview", "options": {"model": "stub-1.0"}}},
        ),
    ):
        with pytest.raises(InvalidUsecaseError):
            complete_prompt(
                usecase=LLMUseCase.EXAMPLE,
                prompt="prompt here",
                message="message here",
                temperature=0.0,
                max_output_tokens=1024,
            )


def test_invalid_provider_config(set_sentry_option):
    with (
        set_sentry_option("llm.provider.options", {"badinput": {"models": ["stub-1.0"]}}),
        set_sentry_option(
            "llm.usecases.options",
            {"example": {"provider": "bad", "options": {"model": "stub-1.0"}}},
        ),
    ):
        with pytest.raises(InvalidProviderError):
            complete_prompt(
                usecase=LLMUseCase.EXAMPLE,
                prompt="prompt here",
                message="message here",
                temperature=0.0,
                max_output_tokens=1024,
            )


def test_invalid_model(set_sentry_option):
    with (
        set_sentry_option("llm.provider.options", {"preview": {"models": ["stub-1.0"]}}),
        set_sentry_option(
            "llm.usecases.options",
            {"example": {"provider": "preview", "options": {"model": "stub-badmodel"}}},
        ),
    ):
        with pytest.raises(InvalidModelError):
            complete_prompt(
                usecase=LLMUseCase.EXAMPLE,
                prompt="prompt here",
                message="message here",
                temperature=0.0,
                max_output_tokens=1024,
            )


def test_invalid_temperature(set_sentry_option):
    with (
        set_sentry_option("llm.provider.options", {"preview": {"models": ["stub-1.0"]}}),
        set_sentry_option(
            "llm.usecases.options",
            {"example": {"provider": "preview", "options": {"model": "stub-1.0"}}},
        ),
    ):
        with pytest.raises(ValueError):
            complete_prompt(
                usecase=LLMUseCase.EXAMPLE,
                prompt="prompt here",
                message="message here",
                temperature=-1,
                max_output_tokens=1024,
            )
        with pytest.raises(ValueError):
            complete_prompt(
                usecase=LLMUseCase.EXAMPLE,
                prompt="prompt here",
                message="message here",
                temperature=2,
                max_output_tokens=1024,
            )
