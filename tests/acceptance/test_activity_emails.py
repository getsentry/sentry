from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class ActivityEmailsTest(AcceptanceTestCase):
    def setUp(self):
        super(ActivityEmailsTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.login_as(self.user)

    def test_assigned_html(self):
        self.browser.get('/debug/mail/assigned/?format=html')
        self.browser.wait_until('#preview')
        self.browser.snapshot('assigned email html')

    def test_assigned_txt(self):
        self.browser.get('/debug/mail/assigned/?format=txt')
        self.browser.wait_until('#preview')
        self.browser.snapshot('assigned email txt')

    def test_assigned_self_html(self):
        self.browser.get('/debug/mail/assigned/self/?format=html')
        self.browser.wait_until('#preview')
        self.browser.snapshot('assigned_self email html')

    def test_assigned_self_txt(self):
        self.browser.get('/debug/mail/assigned/self/?format=txt')
        self.browser.wait_until('#preview')
        self.browser.snapshot('assigned_self email txt')

    def test_note_html(self):
        self.browser.get('/debug/mail/note/?format=html')
        self.browser.wait_until('#preview')
        self.browser.snapshot('note email html')

    def test_note_txt(self):
        self.browser.get('/debug/mail/note/?format=txt')
        self.browser.wait_until('#preview')
        self.browser.snapshot('note email txt')

    def test_regression_html(self):
        self.browser.get('/debug/mail/regression/?format=html')
        self.browser.wait_until('#preview')
        self.browser.snapshot('regression email html')

    def test_regression_txt(self):
        self.browser.get('/debug/mail/regression/?format=txt')
        self.browser.wait_until('#preview')
        self.browser.snapshot('regression email txt')

    def test_regression_with_version_html(self):
        self.browser.get('/debug/mail/regression/release/?format=html')
        self.browser.wait_until('#preview')
        self.browser.snapshot('regression_with_version email html')

    def test_regression_with_version_txt(self):
        self.browser.get('/debug/mail/regression/release/?format=txt')
        self.browser.wait_until('#preview')
        self.browser.snapshot('regression_with_version email txt')

    def test_resolved_html(self):
        self.browser.get('/debug/mail/resolved/?format=html')
        self.browser.wait_until('#preview')
        self.browser.snapshot('resolved email html')

    def test_resolved_txt(self):
        self.browser.get('/debug/mail/resolved/?format=txt')
        self.browser.wait_until('#preview')
        self.browser.snapshot('resolved email txt')

    def test_resolved_in_release_html(self):
        self.browser.get('/debug/mail/resolved-in-release/?format=html')
        self.browser.wait_until('#preview')
        self.browser.snapshot('resolved_in_release email html')

    def test_resolved_in_release_txt(self):
        self.browser.get('/debug/mail/resolved-in-release/?format=txt')
        self.browser.wait_until('#preview')
        self.browser.snapshot('resolved_in_release email txt')

    def test_resolved_in_release_upcoming_html(self):
        self.browser.get('/debug/mail/resolved-in-release/upcoming/?format=html')
        self.browser.wait_until('#preview')
        self.browser.snapshot('resolved_in_release_upcoming email html')

    def test_resolved_in_release_upcoming_txt(self):
        self.browser.get('/debug/mail/resolved-in-release/upcoming/?format=txt')
        self.browser.wait_until('#preview')
        self.browser.snapshot('resolved_in_release_upcoming email txt')

    def test_unassigned_html(self):
        self.browser.get('/debug/mail/unassigned/?format=html')
        self.browser.wait_until('#preview')
        self.browser.snapshot('unassigned email html')

    def test_unassigned_txt(self):
        self.browser.get('/debug/mail/unassigned/?format=txt')
        self.browser.wait_until('#preview')
        self.browser.snapshot('unassigned email txt')
