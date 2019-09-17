from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase, SnubaTestCase


class ProjectReleaseTrackingSettingsTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super(ProjectReleaseTrackingSettingsTest, self).setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])

        self.login_as(self.user)
        self.path1 = u"/{}/{}/settings/release-tracking/".format(self.org.slug, self.project.slug)

    def test_tags_list(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "environment": "prod",
                "release": "first",
                "tags": {"Foo": "value"},
            },
            project_id=self.project.id,
        )
        self.browser.get(self.path1)
        self.browser.wait_until_not(".loading-indicator")
        self.browser.snapshot("project settings - release tracking")
