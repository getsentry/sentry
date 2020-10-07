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
    # XXX(python3): We have different fixtures for python2 vs python3 tests
    # because of the differences in how the random module works betwen 2 and 3.
    # NOTE that we _cannot_ just set the version of the seed, as there are more
    # differences. See [0].
    #
    # [0]: https://stackoverflow.com/questions/55647936/random-randint-shows-different-output-in-python-2-x-and-python-3-x-with-same-see/55648073
    version_suffix = "_py2" if six.PY2 else ""

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
        return u"{}?{}".format(path, urlencode({"format": format, "seed": b"123"}))

    def test_emails(self):
        for url, name in EMAILS:
            # HTML output is captured as a snapshot
            self.browser.get(self.build_url(url, "html"))
            self.browser.wait_until("#preview")
            version_suffix = u"py2" if six.PY2 else u"py3"
            self.browser.snapshot(u"{} email html - {}".format(name, version_suffix))

            # Text output is asserted against static fixture files
            self.browser.get(self.build_url(url, "txt"))
            self.browser.wait_until("#preview")
            elem = self.browser.find_element_by_css_selector("#preview pre")
            text_src = elem.get_attribute("innerHTML")

            fixture_src = read_txt_email_fixture(name)
            assert fixture_src == text_src
