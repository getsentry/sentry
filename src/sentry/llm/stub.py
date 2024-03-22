from sentry.llm.base import LLMBase


class StubLLM(LLMBase):
    def __init__(self, **options):
        pass

    def complete_prompt(
        self, prompt: str, message: str, temperature: float, max_output_tokens: int
    ):
        return ""
