from django.urls import reverse

from sentry.constants import DataCategory
from sentry.testutils.cases import APITestCase, OutcomesSnubaTest
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.silo import region_silo_test
from sentry.utils.outcomes import Outcome


@region_silo_test
@freeze_time(before_now(days=1).replace(minute=10))
class ProjectStatsTest(APITestCase, OutcomesSnubaTest):
    def test_simple(self):
        self.login_as(user=self.user)

        project1 = self.create_project(name="foo")
        project2 = self.create_project(name="bar")

        project_key1 = self.create_project_key(project=project1)
        self.store_outcomes(
            {
                "org_id": project1.organization.id,
                "timestamp": before_now(minutes=1),
                "project_id": project1.id,
                "key_id": project_key1.id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.ERROR,
                "quantity": 3,
            },
            1,
        )
        project_key2 = self.create_project_key(project=project2)
        self.store_outcomes(
            {
                "org_id": project2.organization.id,
                "timestamp": before_now(minutes=1),
                "project_id": project2.id,
                "key_id": project_key2.id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.ERROR,
                "quantity": 5,
            },
            1,
        )

        url = reverse(
            "sentry-api-0-project-stats",
            kwargs={"organization_slug": project1.organization.slug, "project_slug": project1.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data[-1][1] == 3, response.data
        for point in response.data[:-1]:
            assert point[1] == 0
        assert len(response.data) == 24

    def test_get_error_message_stats(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")

        STAT_OPTS = {
            "ip-address": 1,
            "release-version": 2,
            "error-message": 3,
            "browser-extensions": 4,
            "legacy-browsers": 5,
            "localhost": 6,
            "web-crawlers": 7,
            "invalid-csp": 8,
        }
        project_key = self.create_project_key(project=project)
        for reason, count in STAT_OPTS.items():
            self.store_outcomes(
                {
                    "org_id": project.organization.id,
                    "timestamp": before_now(minutes=1),
                    "project_id": project.id,
                    "key_id": project_key.id,
                    "outcome": Outcome.FILTERED,
                    "reason": reason,
                    "category": DataCategory.ERROR,
                    "quantity": count,
                },
                1,
            )

        url = reverse(
            "sentry-api-0-project-stats",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        for stat in STAT_OPTS.keys():
            response = self.client.get(url, {"stat": stat}, format="json")
            assert response.status_code == 200, response.content
            assert len(response.data) == 24
            assert response.data[-1][1] == STAT_OPTS[stat], (stat, response.data)
