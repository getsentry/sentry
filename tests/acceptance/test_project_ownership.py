from __future__ import absolute_import

from django.utils import timezone

from sentry.testutils import AcceptanceTestCase


class ProjectOwnershipTest(AcceptanceTestCase):
    def setUp(self):
        super(ProjectOwnershipTest, self).setUp()
        self.login_as(self.user)
        self.path = u"/settings/{}/projects/{}/ownership/".format(
            self.organization.slug, self.project.slug
        )

    def test_simple(self):
        self.browser.get(self.path)
        self.browser.wait_until_not(".loading")
        self.browser.wait_until('[name="select-type"]')
        self.browser.snapshot("project ownership")
