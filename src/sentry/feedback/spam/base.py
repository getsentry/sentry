from sentry.utils.services import Service


class FeedbackSpamDetectionBase(Service):
    def __init__(self, **options):
        pass

    def spam_detection(self, text: str):
        raise NotImplementedError
