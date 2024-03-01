from fixtures.sudo_testutils import BaseTestCase
from sentry.feedback.spam.stub import StubFeedbackSpamDetection


class TestStubFeedbackSpamDetection(BaseTestCase):
    def test_spam_detection(self):
        res = StubFeedbackSpamDetection.spam_detection(self, "great website!")
        assert res is False
