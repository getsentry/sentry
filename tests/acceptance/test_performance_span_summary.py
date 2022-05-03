from urllib.parse import urlencode

from sentry.testutils.cases import AcceptanceTestCase, SnubaTestCase


class PerformanceSpanSummaryTest(AcceptanceTestCase, SnubaTestCase):
    def setup(self):
        super().setup()
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.group = self.create_group(project=self.project)
        self.login_as(self.user)
        self.path = "/organizations/{}/performance/summary/spans/{}/?{}".format(
            self.org.slug,
            "http:366b14fdccf1deba",
            urlencode({"transaction": "/country_by_code/", "project": self.project.id}),
        )

    def test_
