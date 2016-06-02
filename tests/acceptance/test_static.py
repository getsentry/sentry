from sentry.testutils import LiveServerTestCase


class StaticAcceptanceTest(LiveServerTestCase):
    def test_static(self):
        self.browser.get(self.live_server_url)
