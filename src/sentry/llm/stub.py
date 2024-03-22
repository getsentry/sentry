from sentry.llm.base import LLMBase


class StubLLM(LLMBase):
    def __init__(self, **options):
        pass

    def complete_prompt(self, prompt, message):
        return ""
