from __future__ import absolute_import

from sentry import tagstore
from sentry.testutils import AcceptanceTestCase


class ProjectTagsSettingsTest(AcceptanceTestCase):
    def setUp(self):
        super(ProjectTagsSettingsTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(
            name='Rowdy Tiger',
            owner=None,
        )
        self.team = self.create_team(organization=self.org, name='Mariachi Band')
        self.project = self.create_project(
            organization=self.org,
            teams=[self.team],
            name='Bengal',
        )
        self.create_member(
            user=self.user,
            organization=self.org,
            role='owner',
            teams=[self.team],
        )

        tagstore.create_tag_key(project_id=self.project.id, environment_id=None, key="Foo")

        self.login_as(self.user)
        self.path1 = '/{}/{}/settings/tags/'.format(self.org.slug, self.project.slug)

    def test_tags_list(self):
        self.browser.get(self.path1)
        self.browser.wait_until_not('.loading-indicator')
        self.browser.snapshot('project settings - tags')
        self.browser.wait_until('.ref-tag-row')
        self.browser.click('.ref-tag-row .btn')
        self.browser.wait_until('.modal-footer [data-test-id="confirm-modal"]')
        self.browser.click('.modal-footer [data-test-id="confirm-modal"]')
        self.browser.wait_until_not('.ref-tag-row')
        self.browser.snapshot('project settings - tags - after remove')
