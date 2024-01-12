import functools
import sys

from django.urls import reverse

from sentry.constants import DataCategory
from sentry.testutils.cases import APITestCase, OutcomesSnubaTest
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.silo import region_silo_test
from sentry.utils.outcomes import Outcome


@region_silo_test
@freeze_time(before_now(days=1).replace(hour=1, minute=10))
class OrganizationStatsTest(APITestCase, OutcomesSnubaTest):
    def test_simple(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user)
        project = self.create_project(organization=org)
        project_key = self.create_project_key(project=project)
        self.store_outcomes(
            {
                "org_id": org.id,
                "timestamp": before_now(minutes=1),
                "project_id": project.id,
                "key_id": project_key.id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.ERROR,
                "quantity": 1,
            },
            3,
        )

        url = reverse("sentry-api-0-organization-stats", args=[org.slug])
        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data[-1][1] == 3, response.data
        for point in response.data[:-1]:
            assert point[1] == 0
        assert len(response.data) == 24

    def test_resolution(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user)
        project = self.create_project(organization=org)
        project_key = self.create_project_key(project=project)
        self.store_outcomes(
            {
                "org_id": org.id,
                "timestamp": before_now(hours=1),
                "project_id": project.id,
                "key_id": project_key.id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.ERROR,
                "quantity": 1,
            },
            3,
        )

        url = reverse("sentry-api-0-organization-stats", args=[org.slug])
        response = self.client.get(f"{url}?resolution=1d")

        assert response.status_code == 200, response.content
        assert response.data[-1][1] == 3, response.data
        assert len(response.data) == 1

    def test_resolution_invalid(self):
        self.login_as(user=self.user)
        url = reverse("sentry-api-0-organization-stats", args=[self.organization.slug])
        response = self.client.get(f"{url}?resolution=lol-nope")

        assert response.status_code == 400, response.content

    def test_id_filtering(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user)
        project = self.create_project(
            teams=[self.create_team(organization=org, members=[self.user])]
        )

        make_request = functools.partial(
            self.client.get, reverse("sentry-api-0-organization-stats", args=[org.slug])
        )

        response = make_request({"id": [project.id], "group": "project"})

        assert response.status_code == 200, response.content
        assert project.id in response.data

        response = make_request({"id": [sys.maxsize], "group": "project"})

        assert project.id not in response.data

    def test_project_id_only(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user)
        project = self.create_project(
            teams=[self.create_team(organization=org, members=[self.user])]
        )
        project2 = self.create_project(
            teams=[self.create_team(organization=org, members=[self.user])]
        )

        make_request = functools.partial(
            self.client.get, reverse("sentry-api-0-organization-stats", args=[org.slug])
        )

        response = make_request({"projectID": [project.id], "group": "project"})

        assert response.status_code == 200, response.content
        assert project.id in response.data
        assert project2.id not in response.data
