from sentry.constants import DataCategory
from sentry.models import ProjectKey
from sentry.testutils import APITestCase
from sentry.testutils.cases import OutcomesSnubaTest, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.outcomes import Outcome


class ProjectKeyStatsTest(OutcomesSnubaTest, SnubaTestCase, APITestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.key = ProjectKey.objects.create(project=self.project)
        self.login_as(user=self.user)
        self.path = f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/keys/{self.key.public_key}/stats/"

    def test_simple(self):
        # This outcome should not be included.
        other_key = ProjectKey.objects.create(project=self.project)
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "timestamp": before_now(hours=1),
                "project_id": self.project.id,
                "key_id": other_key.id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.ERROR,
                "quantity": 100,
            },
            1,
        )
        # These outcomes should be included.
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "timestamp": before_now(hours=1),
                "project_id": self.project.id,
                "key_id": self.key.id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.ERROR,
                "quantity": 1,
            },
            2,
        )
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "timestamp": before_now(hours=1),
                "project_id": self.project.id,
                "key_id": self.key.id,
                "outcome": Outcome.FILTERED,
                "reason": "none",
                "category": DataCategory.ERROR,
                "quantity": 1,
            },
            1,
        )
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "timestamp": before_now(hours=1),
                "key_id": self.key.id,
                "project_id": self.project.id,
                "outcome": Outcome.RATE_LIMITED,
                "reason": "none",
                "category": DataCategory.ERROR,
                "quantity": 1,
            },
            5,
        )
        response = self.client.get(self.path)
        assert response.status_code == 200

        assert response.status_code == 200, response.content
        assert type(response.data[-1]["ts"]) == int
        assert response.data[-1]["total"] == 8, response.data
        assert response.data[-1]["filtered"] == 1, response.data
        assert response.data[-1]["dropped"] == 5, response.data
        assert response.data[-1]["accepted"] == 2, response.data
        for point in response.data[:-1]:
            assert point["total"] == 0

    def test_ignore_discard(self):
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "timestamp": before_now(hours=1),
                "project_id": self.project.id,
                "key_id": self.key.id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.ERROR,
                "quantity": 1,
            },
            2,
        )
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "timestamp": before_now(hours=1),
                "project_id": self.project.id,
                "key_id": self.key.id,
                "outcome": Outcome.CLIENT_DISCARD,
                "reason": "none",
                "category": DataCategory.ERROR,
                "quantity": 10,
            },
            1,
        )
        response = self.client.get(self.path)
        assert response.status_code == 200

        assert response.status_code == 200, response.content
        assert response.data[-1]["total"] == 2, response.data
        assert response.data[-1]["filtered"] == 0, response.data

    def test_invalid_parameters(self):
        url = self.path + "?resolution=2d"
        response = self.client.get(url)
        assert response.status_code == 400

    def test_date_conditions(self):
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "timestamp": before_now(hours=1),
                "project_id": self.project.id,
                "key_id": self.key.id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.ERROR,
                "quantity": 1,
            },
            2,
        )
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "timestamp": before_now(days=10),
                "project_id": self.project.id,
                "key_id": self.key.id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.ERROR,
                "quantity": 10,
            },
            1,
        )
        response = self.client.get(
            self.path,
            data={
                "since": before_now(days=1).timestamp(),
                "until": before_now().timestamp(),
            },
        )
        assert response.status_code == 200

        assert response.status_code == 200, response.content
        assert type(response.data[-1]["ts"]) == int
        assert response.data[-1]["total"] == 2, response.data
        assert response.data[-1]["filtered"] == 0, response.data
        assert response.data[-1]["dropped"] == 0, response.data
        assert response.data[-1]["accepted"] == 2, response.data
        for point in response.data[:-1]:
            assert point["total"] == 0
        assert len(response.data) == 2
