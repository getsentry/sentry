from sentry.testutils.cases import TestCase
from sentry.uptime.detectors.hostname_extraction import extract_hostname_from_url


class ExtractHostnameFromUrlTest(TestCase):
    def run_test(self, url: str, expected_fqdn: str | None):
        assert extract_hostname_from_url(url) == expected_fqdn

    def test(self):
        self.run_test("", None)
        self.run_test("192.168.0.1", None)
        self.run_test("https://192.168.0.1", None)
        self.run_test("https://www.sentry.io/", "https://www.sentry.io")
        self.run_test("https://www.sentry.io/some/page", "https://www.sentry.io")
        self.run_test("www.sentry.io", None)
        self.run_test("www.sentry.io/something", None)
        self.run_test("https://www.sentry.nope/", None)
        self.run_test("https://www.sentry.nope/some/page", None)
        self.run_test("https://www.ato.gov.au/", "https://www.ato.gov.au")
