from sentry.utils.services import Service


class LLMBase(Service):
    def __init__(self, **options):
        pass

    def complete_prompt(self, prompt, message, temperature, max_output_tokens):
        raise NotImplementedError
