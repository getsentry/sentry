from __future__ import absolute_import

from six.moves.urllib.parse import urlencode

from sentry.testutils import AcceptanceTestCase


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

    def test_assigned_html(self):
        self.browser.get(self.build_url('/debug/mail/assigned/'))
        self.browser.wait_until('#preview')
        self.browser.snapshot('assigned email html')

    def test_assigned_txt(self):
        self.browser.get(self.build_url('/debug/mail/assigned/', 'txt'))
        self.browser.wait_until('#preview')
        self.browser.snapshot('assigned email txt')

    def test_assigned_self_html(self):
        self.browser.get(self.build_url('/debug/mail/assigned/self/'))
        self.browser.wait_until('#preview')
        self.browser.snapshot('assigned_self email html')

    def test_assigned_self_txt(self):
        self.browser.get(self.build_url('/debug/mail/assigned/self/', 'txt'))
        self.browser.wait_until('#preview')
        self.browser.snapshot('assigned_self email txt')

    def test_note_html(self):
        self.browser.get(self.build_url('/debug/mail/note/'))
        self.browser.wait_until('#preview')
        self.browser.snapshot('note email html')

    def test_note_txt(self):
        self.browser.get(self.build_url('/debug/mail/note/', 'txt'))
        self.browser.wait_until('#preview')
        self.browser.snapshot('note email txt')

    def test_regression_html(self):
        self.browser.get(self.build_url('/debug/mail/regression/'))
        self.browser.wait_until('#preview')
        self.browser.snapshot('regression email html')

    def test_regression_txt(self):
        self.browser.get(self.build_url('/debug/mail/regression/', 'txt'))
        self.browser.wait_until('#preview')
        self.browser.snapshot('regression email txt')

    def test_regression_with_version_html(self):
        self.browser.get(self.build_url('/debug/mail/regression/release/'))
        self.browser.wait_until('#preview')
        self.browser.snapshot('regression_with_version email html')

    def test_regression_with_version_txt(self):
        self.browser.get(self.build_url('/debug/mail/regression/release/', 'txt'))
        self.browser.wait_until('#preview')
        self.browser.snapshot('regression_with_version email txt')

    def test_resolved_html(self):
        self.browser.get(self.build_url('/debug/mail/resolved/'))
        self.browser.wait_until('#preview')
        self.browser.snapshot('resolved email html')

    def test_resolved_txt(self):
        self.browser.get(self.build_url('/debug/mail/resolved/', 'txt'))
        self.browser.wait_until('#preview')
        self.browser.snapshot('resolved email txt')

    def test_resolved_in_release_html(self):
        self.browser.get(self.build_url('/debug/mail/resolved-in-release/'))
        self.browser.wait_until('#preview')
        self.browser.snapshot('resolved_in_release email html')

    def test_resolved_in_release_txt(self):
        self.browser.get(self.build_url('/debug/mail/resolved-in-release/', 'txt'))
        self.browser.wait_until('#preview')
        self.browser.snapshot('resolved_in_release email txt')

    def test_resolved_in_release_upcoming_html(self):
        self.browser.get(self.build_url('/debug/mail/resolved-in-release/upcoming/'))
        self.browser.wait_until('#preview')
        self.browser.snapshot('resolved_in_release_upcoming email html')

    def test_resolved_in_release_upcoming_txt(self):
        self.browser.get(self.build_url('/debug/mail/resolved-in-release/upcoming/', 'txt'))
        self.browser.wait_until('#preview')
        self.browser.snapshot('resolved_in_release_upcoming email txt')

    def test_unassigned_html(self):
        self.browser.get(self.build_url('/debug/mail/unassigned/'))
        self.browser.wait_until('#preview')
        self.browser.snapshot('unassigned email html')

    def test_unassigned_txt(self):
        self.browser.get(self.build_url('/debug/mail/unassigned/', 'txt'))
        self.browser.wait_until('#preview')
        self.browser.snapshot('unassigned email txt')

    def test_new_event_html(self):
        self.browser.get(self.build_url('/debug/mail/new-event/'))
        self.browser.wait_until('#preview')
        self.browser.snapshot('new event email html')

    def test_new_event_txt(self):
        self.browser.get(self.build_url('/debug/mail/new-event/', 'txt'))
        self.browser.wait_until('#preview')
        self.browser.snapshot('new event email txt')

    def test_digest_html(self):
        self.browser.get(self.build_url('/debug/mail/digest/'))
        self.browser.wait_until('#preview')
        self.browser.snapshot('digest email html')

    def test_digest_txt(self):
        self.browser.get(self.build_url('/debug/mail/digest/', 'txt'))
        self.browser.wait_until('#preview')
        self.browser.snapshot('digest email txt')
