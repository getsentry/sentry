from sentry.llm.base import LLMBase


class StubLLM(LLMBase):
    def __init__(self, **options):
        pass

    def chat_completion(self, text):
        return ""
