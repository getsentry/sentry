from sentry.testutils.cases import UptimeTestCase
from sentry.uptime.autodetect.url_extraction import extract_base_url, extract_domain_parts


class ExtractBaseUrlTest(UptimeTestCase):
    def run_test(self, url: str, expected_url: str | None) -> None:
        assert extract_base_url(url) == expected_url

    def test(self) -> None:
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


class ExtractDomainPartsTest(UptimeTestCase):
    def run_test(self, url: str, expected_domain: str, expected_suffix: str) -> None:
        result = extract_domain_parts(url)
        assert (result.domain, result.suffix) == (expected_domain, expected_suffix)

    def test(self) -> None:
        self.run_test("https://www.sentry.io/some/page", "sentry", "io")
        self.run_test("https://www.ato.gov.au/", "ato", "gov.au")

    def test_hosting_suffixes(self) -> None:
        # Each app on a hosting platform counts as its own domain
        self.run_test("https://my-app.onrender.com", "my-app", "onrender.com")
        self.run_test("https://my-app.up.railway.app", "my-app", "up.railway.app")
        self.run_test("https://main.d1abc2def3.amplifyapp.com", "d1abc2def3", "amplifyapp.com")
