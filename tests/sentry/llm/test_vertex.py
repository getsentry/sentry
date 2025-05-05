from unittest.mock import Mock, patch

import pytest

from sentry.llm.exceptions import VertexRequestFailed
from sentry.llm.usecases import LLMUseCase, complete_prompt, llm_provider_backends


@pytest.fixture
def mock_options(set_sentry_option):
    with (
        set_sentry_option(
            "llm.provider.options",
            {
                "vertex": {
                    "models": ["vertex-1.0"],
                    "options": {"project": "my-gcp-project", "location": "us-central1"},
                }
            },
        ),
        set_sentry_option(
            "llm.usecases.options",
            {"example": {"provider": "vertex", "options": {"model": "vertex-1.0"}}},
        ),
    ):
        yield


class MockGenaiClient:
    def __init__(self, mock_generate_content):
        self.models = type(
            "obj",
            (object,),
            {"generate_content": mock_generate_content},
        )()


def test_complete_prompt(mock_options):
    llm_provider_backends.clear()
    mock_generate_content = Mock(
        return_value=type(
            "obj",
            (object,),
            {"status_code": 200, "text": "hello world"},
        )()
    )

    with patch(
        "sentry.llm.providers.vertex.VertexProvider._create_genai_client",
        return_value=MockGenaiClient(mock_generate_content),
    ):
        res = complete_prompt(
            usecase=LLMUseCase.EXAMPLE,
            prompt="prompt here",
            message="message here",
            temperature=0.0,
            max_output_tokens=1024,
        )

    assert res == "hello world"
    assert mock_generate_content.call_count == 1
    assert mock_generate_content.call_args[1]["model"] == "vertex-1.0"


def test_complete_prompt_error(mock_options):
    llm_provider_backends.clear()
    mock_generate_content = Mock(
        return_value=type(
            "obj",
            (object,),
            {"status_code": 400},
        )()
    )

    with patch(
        "sentry.llm.providers.vertex.VertexProvider._create_genai_client",
        return_value=MockGenaiClient(mock_generate_content),
    ):
        with pytest.raises(VertexRequestFailed):
            complete_prompt(
                usecase=LLMUseCase.EXAMPLE,
                message="message here",
                temperature=0.0,
                max_output_tokens=1024,
            )
