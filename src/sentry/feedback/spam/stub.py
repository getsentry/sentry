from sentry.feedback.spam.base import FeedbackSpamDetectionBase


class StubFeedbackSpamDetection(FeedbackSpamDetectionBase):
    def __init__(self, **options):
        pass

    def spam_detection(self, text):
        return False
