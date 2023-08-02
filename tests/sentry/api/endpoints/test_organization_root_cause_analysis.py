from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test

ROOT_CAUSE_FEATURE_FLAG = "organizations:statistical-detectors-root-cause-analysis"


@region_silo_test(stable=True)
class OrganizationRootCauseAnalysisTest(APITestCase):
    def setUp(self):
        self.login_as(self.user)
        self.org = self.create_organization(owner=self.user)
        self.url = reverse(
            "sentry-api-0-organization-events-root-cause-analysis", args=[self.org.slug]
        )

        return super().setUp()

    def test_404s_without_feature_flag(self):
        response = self.client.get(self.url, format="json")
        assert response.status_code == 404, response.content

    def test_can_call_endpoint(self):
        with self.feature(ROOT_CAUSE_FEATURE_FLAG):
            response = self.client.get(
                self.url, format="json", data={"transaction": "foo", "project": "1"}
            )

        assert response.status_code == 200, response.content

    def test_transaction_name_required(self):
        with self.feature(ROOT_CAUSE_FEATURE_FLAG):
            response = self.client.get(self.url, format="json")

        assert response.status_code == 400, response.content

    def test_project_id_required(self):
        with self.feature(ROOT_CAUSE_FEATURE_FLAG):
            response = self.client.get(self.url, format="json", data={"transaction": "foo"})

        assert response.status_code == 400, response.content
