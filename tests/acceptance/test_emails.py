from __future__ import absolute_import

import six
import os.path

from six.moves.urllib.parse import urlencode
from os.path import join, dirname

from sentry.testutils import AcceptanceTestCase

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
    ("/debug/mail/alert/", "alert"),
    ("/debug/mail/digest/", "digest"),
    ("/debug/mail/invalid-identity/", "invalid identity"),
    ("/debug/mail/invitation/", "invitation"),
    ("/debug/mail/report/", "report"),
    ("/debug/mail/mfa-added/", "mfa added"),
    ("/debug/mail/mfa-removed/", "mfa removed"),
    ("/debug/mail/recovery-codes-regenerated/", "recovery codes regenerated"),
    ("/debug/mail/password-changed/", "password changed"),
    ("/debug/mail/sso-linked", "sso linked"),
    ("/debug/mail/sso-unlinked", "sso unlinked"),
    ("/debug/mail/sso-unlinked/no-password", "sso unlinked without password"),
)


def read_txt_email_fixture(name):
    version_suffix = "_py2"

    # "sso unlinked without password"
    # => "sso_unlinked_without_password.txt"
    filename = name.replace(" ", "_") + version_suffix + ".txt"
    path = join(dirname(__file__), os.pardir, "fixtures", "emails", filename)

    fixture = None
    with open(path, "r") as f:
        fixture = f.read()
    return fixture


class EmailTestCase(AcceptanceTestCase):
    def setUp(self):
        super(EmailTestCase, self).setUp()
        self.user = self.create_user("foo@example.com")
        self.login_as(self.user)

    def build_url(self, path, format="html"):
        return u"{}?{}".format(path, urlencode({"format": format}))

    def test_emails(self):
        for url, name in EMAILS:
            # HTML output is captured as a snapshot
            #self.browser.get(self.build_url(url, "html"))
            #self.browser.wait_until("#preview")

            # This should be named py3.
            # Or, we fix things so that py3 == py2.
            #self.browser.snapshot(u"{} email html".format(name))

            # Text output is asserted against static fixture files
            self.browser.get(self.build_url(url, "txt"))
            self.browser.wait_until("#preview")
            elem = self.browser.find_element_by_css_selector("#preview pre")
            text_src = elem.get_attribute("innerHTML")

            fixture_src = read_txt_email_fixture(name)
            assert fixture_src == text_src
