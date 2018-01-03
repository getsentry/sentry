from __future__ import absolute_import

from six.moves.urllib.parse import urlencode

from sentry.testutils import AcceptanceTestCase

EMAILS = (
    ('/debug/mail/assigned/', 'assigned'),
    ('/debug/mail/assigned/self/', 'assigned self'),
    ('/debug/mail/note/', 'note'),
    ('/debug/mail/regression/', 'regression'),
    ('/debug/mail/regression/release/', 'regression with version'),
    ('/debug/mail/new-release/', 'release'),
    ('/debug/mail/resolved/', 'resolved'),
    ('/debug/mail/resolved-in-release/', 'resolved in release'),
    ('/debug/mail/resolved-in-release/upcoming/', 'resolved in release upcoming'),
    ('/debug/mail/unassigned/', 'unassigned'),
    ('/debug/mail/unable-to-fetch-commits/', 'unable to fetch commits'),
    ('/debug/mail/unable-to-delete-repo/', 'unable to delete repo'),
    ('/debug/mail/alert/', 'alert'),
    ('/debug/mail/digest/', 'digest'),
    ('/debug/mail/invalid-identity/', 'invalid identity'),
    ('/debug/mail/invitation/', 'invitation'),
    ('/debug/mail/report/', 'report'),
    ('/debug/mail/mfa-added/', 'mfa added'),
    ('/debug/mail/mfa-removed/', 'mfa removed'),
    ('/debug/mail/password-changed/', 'password changed'),
    ('/debug/mail/sso-linked', 'sso linked'),
    ('/debug/mail/sso-unlinked', 'sso unlinked'),
    ('/debug/mail/sso-unlinked/no-password', 'sso unlinked without password'),
)


class EmailTestCase(AcceptanceTestCase):
    def setUp(self):
        super(EmailTestCase, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.login_as(self.user)

    def build_url(self, path, format='html'):
        return u'{}?{}'.format(
            path,
            urlencode({
                'format': format,
                'seed': '123',
            }),
        )

    def test_emails(self):
        for url, name in EMAILS:
            self.browser.get(self.build_url(url, 'html'))
            self.browser.wait_until('#preview')
            self.browser.snapshot('{} email html'.format(name))

            self.browser.get(self.build_url(url, 'txt'))
            self.browser.wait_until('#preview')
            self.browser.snapshot('{} email txt'.format(name))
