from urllib.parse import urlencode

from selenium.webdriver.common.by import By

from sentry.testutils import AcceptanceTestCase
from sentry.testutils.factories import get_fixture_path

EMAILS = (
    ("/debug/mail/assigned/", "assigned"),
    ("/debug/mail/assigned/self/", "assigned self"),
    ("/debug/mail/note/", "note"),
    ("/debug/mail/regression/", "regression"),
    ("/debug/mail/regression/release/", "regression with version"),
    ("/debug/mail/new-release/", "release"),
    ("/debug/mail/resolved/", "resolved"),
    ("/debug/mail/resolved-in-release/", "resolved in release"),
    ("/debug/mail/resolved-in-release/upcoming/", "resolved in release upcoming"),
    ("/debug/mail/unassigned/", "unassigned"),
    ("/debug/mail/unable-to-fetch-commits/", "unable to fetch commits"),
    ("/debug/mail/unable-to-delete-repo/", "unable to delete repo"),
    ("/debug/mail/error-alert/", "alert"),
    ("/debug/mail/performance-alert/", "performance"),
    ("/debug/mail/digest/", "digest"),
    ("/debug/mail/invalid-identity/", "invalid identity"),
    ("/debug/mail/invitation/", "invitation"),
    ("/debug/mail/mfa-added/", "mfa added"),
    ("/debug/mail/mfa-removed/", "mfa removed"),
    ("/debug/mail/recovery-codes-regenerated/", "recovery codes regenerated"),
    ("/debug/mail/password-changed/", "password changed"),
    ("/debug/mail/sso-linked", "sso linked"),
    ("/debug/mail/sso-unlinked", "sso unlinked"),
    ("/debug/mail/sso-unlinked/no-password", "sso unlinked without password"),
)


def read_txt_email_fixture(name: str) -> str:
    # "sso unlinked without password"
    # => "sso_unlinked_without_password.txt"
    filename = name.replace(" ", "_") + ".txt"

    with open(get_fixture_path("emails", filename)) as f:
        return f.read()


def build_url(path: str, format: str = "html") -> str:
    return f"{path}?{urlencode({'format': format, 'seed': b'123'})}"


class EmailTestCase(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        # This email address is required to match FIXTURES.
        self.user = self.create_user("foo@example.com")
        self.login_as(self.user)

    def test_emails(self):
        for url, name in EMAILS:
            # HTML output is captured as a snapshot
            self.browser.get(build_url(url, "html"))
            self.browser.wait_until("#preview")
            self.browser.snapshot(f"{name} email html")

            # Text output is asserted against static fixture files
            self.browser.get(build_url(url, "txt"))
            self.browser.wait_until("#preview")
            elem = self.browser.find_element(by=By.CSS_SELECTOR, value="#preview pre")
            text_src = elem.get_attribute("innerHTML")

            fixture_src = read_txt_email_fixture(name)
            assert fixture_src == text_src
