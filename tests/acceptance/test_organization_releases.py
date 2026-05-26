from datetime import UTC, datetime

import pytest
from django.utils import timezone

from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test

pytestmark = pytest.mark.sentry_metrics


@no_silo_test
class OrganizationReleasesTest(AcceptanceTestCase):
    release_date = datetime(2020, 5, 18, 15, 13, 58, 132928, tzinfo=UTC)

    def setUp(self) -> None:
        super().setUp()

        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.project2 = self.create_project(
            organization=self.org, teams=[self.team], name="Bengal 2"
        )
        self.create_project(organization=self.org, teams=[self.team], name="Bengal 3")
        self.login_as(self.user)
        self.path = f"/organizations/{self.org.slug}/releases/"
        self.project.update(first_event=timezone.now())

    def test_detail_pick_project(self) -> None:
        release = self.create_release(
            project=self.project,
            additional_projects=[self.project2],
            version="1.0",
            date_added=self.release_date,
        )
        self.browser.get(self.path + release.version)
        self.browser.wait_until_not(".loading")
        assert "Select a project to continue" in self.browser.element("[role='dialog'] header").text
