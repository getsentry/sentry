from unittest.mock import Mock, patch

from sentry.llm.usecases import LlmUseCase, complete_prompt


def test_complete_prompt(set_sentry_option):
    with (
        set_sentry_option(
            "llm.provider.options",
            {"openai": {"models": ["gpt-4-turbo-1.0"], "options": {"api_key": "fake_api_key"}}},
        ),
        set_sentry_option(
            "llm.usecases.options",
            {"example": {"provider": "openai", "options": {"model": "gpt-4-turbo-1.0"}}},
        ),
        patch("sentry.llm.providers.openai.get_openai_client") as mock_get_client,
    ):
        mock_client = Mock()
        mock_get_client.return_value = mock_client
        mock_response = Mock()
        mock_response.choices = [Mock(message=Mock(content=""))]
        mock_client.chat.completions.create.return_value = mock_response

        res = complete_prompt(
            usecase=LlmUseCase.EXAMPLE,
            prompt="prompt here",
            message="message here",
            temperature=0.0,
            max_output_tokens=1024,
        )
    assert res == ""
