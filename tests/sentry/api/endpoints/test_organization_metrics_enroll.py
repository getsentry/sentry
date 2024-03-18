from __future__ import annotations

from django.urls import reverse

from sentry.models.apitoken import ApiToken
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test


@region_silo_test
class OrganizationMetricsEnrollTest(APITestCase):
    endpoint = "sentry-api-0-organization-metrics-enroll"
    method = "put"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_enroll(self):
        self.get_success_response(
            self.organization.slug, status_code=200, qs_params={"enroll": "true"}
        )
        assert self.organization.get_option("sentry:custom_metrics_access")

        self.get_success_response(
            self.organization.slug, status_code=200, qs_params={"enroll": "false"}
        )
        assert not self.organization.get_option("sentry:custom_metrics_access")

    def test_permissions(self):
        for scope in ["org:read", "org:write", "org:admin"]:
            with assume_test_silo_mode(SiloMode.CONTROL):
                token = ApiToken.objects.create(user=self.user, scope_list=[scope])

            url = reverse(self.endpoint, args=(self.project.organization.slug,))
            response = getattr(self.client, self.method)(
                url, HTTP_AUTHORIZATION=f"Bearer {token.token}", format="json"
            )
            assert response.status_code == 200, f"Expected 200 response with scop {scope}"
