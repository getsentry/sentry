from fixtures.sudo_testutils import BaseTestCase
from sentry.feedback.spam.stub import StubFeedbackSpamDetection


class TestStubFeedbackSpamDetection(BaseTestCase):
    def test_spam_detection(self):
        stub = StubFeedbackSpamDetection()
        res = stub.spam_detection("great website!")
        assert res is False
