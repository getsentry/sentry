from django.urls import reverse

from sentry.models.apitoken import ApiToken
from sentry.sentry_metrics.visibility import get_metrics_blocking_state
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test


@region_silo_test
class ProjectMetricsVisibilityEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-project-metrics-visibility"

    def setUp(self):
        self.login_as(user=self.user)

    def send_put_request(self, token, endpoint):
        url = reverse(endpoint, args=(self.project.organization.slug, self.project.slug))
        return self.client.put(url, HTTP_AUTHORIZATION=f"Bearer {token.token}", format="json")

    def test_permissions(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=[])

        response = self.send_put_request(token, self.endpoint)
        assert response.status_code == 403

        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])

        response = self.send_put_request(token, self.endpoint)
        assert response.status_code != 403

    def test_block_metric(self):
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="put",
            operationType="blockMetric",
            metricMri="s:custom/user@none",
        )

        assert response.status_code == 200
        assert len(get_metrics_blocking_state([self.project])[self.project.id].metrics) == 1

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="put",
            operationType="unblockMetric",
            metricMri="s:custom/user@none",
        )

        assert response.status_code == 200
        assert len(get_metrics_blocking_state([self.project])[self.project.id].metrics) == 0

    def test_block_metric_tag(self):
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="put",
            operationType="blockTags",
            metricMri="s:custom/user@none",
            tags=["release", "transaction"],
        )

        assert response.status_code == 200
        assert len(get_metrics_blocking_state([self.project])[self.project.id].metrics) == 1

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="put",
            operationType="unblockTags",
            metricMri="s:custom/user@none",
            tags=["transaction"],
        )

        assert response.status_code == 200
        assert len(get_metrics_blocking_state([self.project])[self.project.id].metrics) == 1

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="put",
            operationType="unblockTags",
            metricMri="s:custom/user@none",
            tags=["release"],
        )

        assert response.status_code == 200
        assert len(get_metrics_blocking_state([self.project])[self.project.id].metrics) == 0
