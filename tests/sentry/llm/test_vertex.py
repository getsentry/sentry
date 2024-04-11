from unittest.mock import patch

from sentry.llm.usecases import LlmUseCase, complete_prompt


def test_complete_prompt(set_sentry_option):
    with (
        set_sentry_option(
            "llm.provider.options",
            {"vertex": {"models": ["vertex-1.0"], "options": {"url": "fake_url"}}},
        ),
        set_sentry_option(
            "llm.usecases.options",
            {"example": {"provider": "vertex", "options": {"model": "vertex-1.0"}}},
        ),
        patch(
            "sentry.llm.providers.vertex.VertexProvider._get_access_token",
            return_value="fake_token",
        ),
        patch(
            "requests.post",
            return_value=type(
                "obj",
                (object,),
                {"status_code": 200, "json": lambda x: {"predictions": [{"content": ""}]}},
            )(),
        ),
    ):
        res = complete_prompt(LlmUseCase.EXAMPLE, "prompt here", "message here", 0.0, 1024)
    assert res == ""
