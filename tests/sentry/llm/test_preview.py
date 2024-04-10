from fixtures.sudo_testutils import BaseTestCase
from sentry.llm.usecases import LlmUseCase, complete_prompt


class TestStubLLM(BaseTestCase):
    def test_complete_prompt(self):
        res = complete_prompt(LlmUseCase.SUGGESTED_FIX, "prompt here", "message here", 0.0, 1024)
        assert res == ""
