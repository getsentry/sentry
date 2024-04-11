import pytest

from sentry.llm.usecases import LlmUseCase, complete_prompt


def test_complete_prompt(set_sentry_option):
    with (
        set_sentry_option("llm.provider.options", {"preview": {"models": ["stub-1.0"]}}),
        set_sentry_option(
            "llm.usecases.options",
            {"example": {"provider": "preview", "options": {"model": "stub-1.0"}}},
        ),
    ):
        res = complete_prompt(LlmUseCase.EXAMPLE, "prompt here", "message here", 0.0, 1024)

    assert res == ""


def test_invalid_usecase_config(set_sentry_option):
    with (
        set_sentry_option("llm.provider.options", {"preview": {"models": ["stub-1.0"]}}),
        set_sentry_option(
            "llm.usecases.options",
            {"other": {"provider": "preview", "options": {"model": "stub-1.0"}}},
        ),
    ):
        with pytest.raises(ValueError):
            complete_prompt(LlmUseCase.EXAMPLE, "prompt here", "message here", 0.0, 1024)


def test_invalid_provider_config(set_sentry_option):
    with (
        set_sentry_option("llm.provider.options", {"badinput": {"models": ["stub-1.0"]}}),
        set_sentry_option(
            "llm.usecases.options",
            {"example": {"provider": "preview", "options": {"model": "stub-1.0"}}},
        ),
    ):
        with pytest.raises(ValueError):
            complete_prompt(LlmUseCase.EXAMPLE, "prompt here", "message here", 0.0, 1024)


def test_invalid_model(set_sentry_option):
    with (
        set_sentry_option("llm.provider.options", {"preview": {"models": ["stub-1.0"]}}),
        set_sentry_option(
            "llm.usecases.options",
            {"example": {"provider": "preview", "options": {"model": "stub-badmodel"}}},
        ),
    ):
        with pytest.raises(ValueError):
            complete_prompt(LlmUseCase.EXAMPLE, "prompt here", "message here", 0.0, 1024)
