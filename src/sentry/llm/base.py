from sentry.utils.services import Service


class LLMBase(Service):
    def __init__(self, **options):
        pass

    def chat_completion(self, text: str):
        raise NotImplementedError
