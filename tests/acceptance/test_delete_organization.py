from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class DeleteOrganizationTest(AcceptanceTestCase):
    def setUp(self):
        super(DeleteOrganizationTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(owner=self.user, name='Rowdy Tiger')
        self.login_as(self.user)

    def test_simple(self):
        self.browser.get('/organizations/{}/settings/'.format(self.org.slug))
        self.browser.wait_until('.ref-organization-settings')
        self.browser.find_element_by_xpath("//a[contains(text(), 'Remove Organization')]").click()
        self.browser.wait_until('.modal-dialog')
        self.browser.click_when_visible('.modal-dialog .button-danger')
        self.browser.wait_until('body.narrow')
        self.browser.snapshot(name='no-organizations-after-delete')
