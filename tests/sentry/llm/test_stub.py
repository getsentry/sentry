from fixtures.sudo_testutils import BaseTestCase
from sentry.llm.stub import StubLLM


class TestStubLLM(BaseTestCase):
    def test_complete_prompt(self):
        stub = StubLLM()
        res = stub.complete_prompt("prompt here", "message here")
        assert res == ""
