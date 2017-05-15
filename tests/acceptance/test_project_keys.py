from __future__ import absolute_import

from sentry.models import ProjectKey
from sentry.testutils import AcceptanceTestCase


class ProjectKeysTest(AcceptanceTestCase):
    def setUp(self):
        super(ProjectKeysTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(
            name='Rowdy Tiger',
            owner=None,
        )
        self.team = self.create_team(
            organization=self.org,
            name='Mariachi Band'
        )
        self.project = self.create_project(
            organization=self.org,
            team=self.team,
            name='Bengal',
        )
        self.create_member(
            user=self.user,
            organization=self.org,
            role='owner',
            teams=[self.team],
        )

        self.login_as(self.user)
        self.path = '/{}/{}/settings/keys/'.format(self.org.slug, self.project.slug)

    def test_simple(self):
        self.browser.get(self.path)
        self.browser.wait_until_not('.loading-indicator')
        self.browser.snapshot('project keys')
        self.browser.wait_until('.ref-keys')


class ProjectKeyDetailsTest(AcceptanceTestCase):
    def setUp(self):
        super(ProjectKeyDetailsTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(
            name='Rowdy Tiger',
            owner=None,
        )
        self.team = self.create_team(
            organization=self.org,
            name='Mariachi Band'
        )
        self.project = self.create_project(
            organization=self.org,
            team=self.team,
            name='Bengal',
        )
        self.create_member(
            user=self.user,
            organization=self.org,
            role='owner',
            teams=[self.team],
        )

        self.pk = ProjectKey.objects.create(project=self.project)

        self.login_as(self.user)
        self.path = '/{}/{}/settings/keys/{}/'.format(
            self.org.slug, self.project.slug, self.pk.public_key,
        )

    def test_simple(self):
        self.browser.get(self.path)
        self.browser.wait_until_not('.loading-indicator')
        self.browser.snapshot('project key details')
        self.browser.wait_until('.ref-key-details')
