import re
from urllib.parse import urlencode

from selenium.webdriver.common.by import By

from sentry.receivers import create_default_projects
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.silo import no_silo_test

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
    ("/debug/mail/performance-alert/transaction-n-plus-one", "performance"),
    ("/debug/mail/performance-alert/transaction-n-plus-one-api-call/", "n1 api call"),
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
    return f"{path}?{urlencode({'format': format, 'seed': b'123', 'is_test': True})}"


def redact_ids(text: str) -> str:
    issues_re = re.compile("(testserver/organizations/sentry/issues/[0-9]+/)")
    match = issues_re.search(text)
    if match:
        for g in match.groups():
            text = text.replace(g, "testserver/organizations/sentry/issues/x/")
    return text


def redact_ips(text: str) -> str:
    return re.sub(r"IP: [0-9]{1,3}(\.[0-9]{1,3}){3}\b", "IP: <IP_ADDRESS>", text)


def redact_notification_uuid(text: str) -> str:
    return re.sub("uuid=[A-Za-z0-9_-]+", "uuid=x", text)


def replace_amp(text: str) -> str:
    return re.sub("¬", "&not", text)


@no_silo_test
class EmailTestCase(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        create_default_projects()
        # This email address is required to match FIXTURES.
        self.user = self.create_user("foo@example.com")
        self.login_as(self.user)

    def test_emails(self):
        for url, name in EMAILS:
            # HTML output is captured as a snapshot
            self.browser.get(build_url(url, "html"))
            self.browser.wait_until("#preview")

            # Text output is asserted against static fixture files
            self.browser.get(build_url(url, "txt"))
            self.browser.wait_until("#preview")
            elem = self.browser.find_element(by=By.CSS_SELECTOR, value="#preview pre")
            text_src = elem.get_attribute("innerHTML")

            # Avoid relying on IDs as this can cause flakey tests
            text_src = redact_ips(redact_ids(replace_amp(text_src)))

            fixture_src = read_txt_email_fixture(name)
            assert redact_notification_uuid(fixture_src) == redact_notification_uuid(text_src)
