import pytest

from sentry.constants import DataCategory
from sentry.models.projectkey import ProjectKey
from sentry.testutils.cases import APITestCase, OutcomesSnubaTest, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.silo import region_silo_test
from sentry.utils.outcomes import Outcome


@freeze_time("2022-01-01 03:30:00")
@region_silo_test
class ProjectKeyStatsTest(OutcomesSnubaTest, SnubaTestCase, APITestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.key = ProjectKey.objects.create(project=self.project)
        self.login_as(user=self.user)
        self.path = f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/keys/{self.key.public_key}/stats/"

    @pytest.mark.skip(reason="flakey: https://github.com/getsentry/sentry/issues/54520")
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
        assert response.status_code == 200, response.content

        # Find the bucket with data.
        # The index of this bucket can shift when we run tests at UTC midnight
        result = [bucket for bucket in response.data if bucket["total"] > 0][0]
        assert isinstance(result["ts"], int)
        assert result["total"] == 8, response.data
        assert result["filtered"] == 1, response.data
        assert result["dropped"] == 5, response.data
        assert result["accepted"] == 2, response.data

    @pytest.mark.skip(reason="flakey: https://github.com/getsentry/sentry/issues/46402")
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
        assert response.status_code == 200, response.content

        result = [bucket for bucket in response.data if bucket["total"] > 0][0]
        assert result["total"] == 2, response.data
        assert result["filtered"] == 0, response.data

    def test_invalid_parameters(self):
        url = self.path + "?resolution=2d"
        response = self.client.get(url)
        assert response.status_code == 400

    @pytest.mark.skip(reason="flakey: https://github.com/getsentry/sentry/issues/46402")
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
        assert response.status_code == 200, response.content

        result = [bucket for bucket in response.data if bucket["total"] > 0][0]
        assert isinstance(result["ts"], int)
        assert result["total"] == 2, response.data
        assert result["filtered"] == 0, response.data
        assert result["dropped"] == 0, response.data
        assert result["accepted"] == 2, response.data
        assert len(response.data) == 2
