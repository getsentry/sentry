from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class StyleGuideTest(AcceptanceTestCase):
    def setUp(self):
        super(StyleGuideTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.login_as(self.user)

    def test_visit(self):
        self.browser.get('/styleguide/')
        self.browser.snapshot(name='styleguide')
