from fixtures.sudo_testutils import BaseTestCase
from sentry.llm.stub import StubLLM


class TestStubLLM(BaseTestCase):
    def test_chat_completion(self):
        stub = StubLLM()
        res = stub.chat_completion("prompt here", "message here")
        assert res == ""
