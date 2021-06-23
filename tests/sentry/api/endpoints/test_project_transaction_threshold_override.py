from django.urls import reverse

from sentry.models.transaction_threshold import (
    ProjectTransactionThresholdOverride,
    TransactionMetric,
)
from sentry.testutils import APITestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data


class ProjectTransactionThresholdOverrideTest(APITestCase):
    feature_name = "organizations:project-transaction-threshold-override"

    def setUp(self) -> None:
        super().setUp()

        self.login_as(user=self.user)

        self.org = self.create_organization(owner=self.user, name="Captain Planet")
        self.team = self.create_team(organization=self.org, name="Planeteers", members=[self.user])
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Earth")

        self.url = reverse(
            "sentry-api-0-organization-project-transaction-threshold-override",
            args=[self.org.slug],
        )

        self.data = load_data(
            "transaction",
            timestamp=before_now(minutes=1),
            start_timestamp=before_now(minutes=1, milliseconds=500),
        )
        self.data["transaction"] = "earth"
        self.store_event(self.data, project_id=self.project.id)

    def test_get_for_project_with_custom_threshold(self):
        ProjectTransactionThresholdOverride.objects.create(
            transaction="earth",
            project=self.project,
            organization=self.project.organization,
            threshold=400,
            metric=TransactionMetric.LCP.value,
        )

        with self.feature(self.feature_name):
            response = self.client.get(
                self.url,
                data={
                    "project": [self.project.id],
                    "transaction": self.data["transaction"],
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        assert response.data["threshold"] == "400"
        assert response.data["metric"] == "lcp"

    def test_get_for_project_without_custom_threshold(self):
        with self.feature(self.feature_name):
            response = self.client.get(
                self.url,
                data={
                    "project": [self.project.id],
                    "transaction": self.data["transaction"],
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        assert response.data["threshold"] == "300"
        assert response.data["metric"] == "duration"

    def test_get_returns_error_without_feature_enabled(self):
        ProjectTransactionThresholdOverride.objects.create(
            project=self.project,
            organization=self.project.organization,
            threshold=300,
            metric=TransactionMetric.DURATION.value,
        )

        response = self.client.get(
            self.url,
            data={
                "project": [self.project.id],
                "transaction": self.data["transaction"],
            },
            format="json",
        )
        assert response.status_code == 404

    def test_create_project_threshold(self):
        assert not ProjectTransactionThresholdOverride.objects.filter(
            transaction=self.data["transaction"],
            project=self.project,
            organization=self.org,
        ).exists()

        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                data={
                    "transaction": self.data["transaction"],
                    "project": [self.project.id],
                    "metric": "duration",
                    "threshold": "600",
                },
            )

        assert response.status_code == 201, response.content
        assert response.data["threshold"] == "600"
        assert response.data["metric"] == "duration"
        assert response.data["editedBy"] == str(self.user.id)

        assert ProjectTransactionThresholdOverride.objects.filter(
            transaction=self.data["transaction"],
            project=self.project,
            organization=self.org,
        ).exists()

    def test_update_project_threshold(self):
        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                data={
                    "metric": "duration",
                    "threshold": "300",
                },
            )

        assert response.status_code == 201, response.content
        assert response.data["threshold"] == "300"
        assert response.data["metric"] == "duration"

        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                data={
                    "metric": "lcp",
                    "threshold": "400",
                },
            )

        assert response.status_code == 200, response.content
        assert response.data["threshold"] == "400"
        assert response.data["metric"] == "lcp"

    def test_clear_project_threshold(self):
        ProjectTransactionThresholdOverride.objects.create(
            project=self.project,
            transaction=self.data["transaction"],
            organization=self.project.organization,
            threshold=900,
            metric=TransactionMetric.LCP.value,
        )
        assert ProjectTransactionThresholdOverride.objects.filter(
            transaction=self.data["transaction"],
            project=self.project,
            organization=self.project.organization,
        ).exists()

        with self.feature(self.feature_name):
            response = self.client.delete(self.url)

        assert response.status_code == 204
        assert not ProjectTransactionThresholdOverride.objects.filter(
            transaction=self.data["transaction"],
            project=self.project,
            organization=self.project.organization,
        ).exists()
