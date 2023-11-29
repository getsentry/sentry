from django.urls import reverse

from sentry.models.transaction_threshold import ProjectTransactionThreshold, TransactionMetric
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ProjectTransactionThresholdTest(APITestCase):
    feature_name = "organizations:performance-view"

    def setUp(self) -> None:
        super().setUp()

        self.login_as(user=self.user)
        self.project = self.create_project()

        self.url = reverse(
            "sentry-api-0-project-transaction-threshold",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )

    def test_get_for_project_with_custom_threshold(self):
        ProjectTransactionThreshold.objects.create(
            project=self.project,
            organization=self.project.organization,
            threshold=500,
            metric=TransactionMetric.LCP.value,
        )

        with self.feature(self.feature_name):
            response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["threshold"] == "500"
        assert response.data["metric"] == "lcp"

    def test_get_for_project_without_custom_threshold(self):
        with self.feature(self.feature_name):
            response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["threshold"] == "300"
        assert response.data["metric"] == "duration"

    def test_get_returns_error_without_feature_enabled(self):
        with self.feature({self.feature_name: False}):
            ProjectTransactionThreshold.objects.create(
                project=self.project,
                organization=self.project.organization,
                threshold=300,
                metric=TransactionMetric.DURATION.value,
            )

            response = self.client.get(self.url, format="json")
            assert response.status_code == 404

    def test_create_project_threshold(self):
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
        assert response.data["editedBy"] == str(self.user.id)

        assert ProjectTransactionThreshold.objects.filter(
            project=self.project, organization=self.project.organization
        ).exists()

    def test_project_threshold_permissions(self):
        user = self.create_user()
        # user without project-write permissions
        self.create_member(user=user, organization=self.organization, role="member")
        self.login_as(user=user)

        team = self.create_team()
        project = self.create_project(teams=[team], name="foo")

        url = reverse(
            "sentry-api-0-project-transaction-threshold",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        ProjectTransactionThreshold.objects.create(
            project=project,
            organization=project.organization,
            threshold=300,
            metric=TransactionMetric.DURATION.value,
        )

        with self.feature(self.feature_name):
            response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content

        with self.feature(self.feature_name):
            response = self.client.post(
                url,
                data={
                    "metric": "lcp",
                    "threshold": "400",
                },
            )

        assert response.status_code == 403

        with self.feature(self.feature_name):
            response = self.client.delete(url)

        assert response.status_code == 403

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
        ProjectTransactionThreshold.objects.create(
            project=self.project,
            organization=self.project.organization,
            threshold=300,
            metric=TransactionMetric.DURATION.value,
        )
        assert ProjectTransactionThreshold.objects.filter(
            project=self.project, organization=self.project.organization
        ).exists()

        with self.feature(self.feature_name):
            response = self.client.delete(self.url)

        assert response.status_code == 204
        assert not ProjectTransactionThreshold.objects.filter(
            project=self.project, organization=self.project.organization
        ).exists()
