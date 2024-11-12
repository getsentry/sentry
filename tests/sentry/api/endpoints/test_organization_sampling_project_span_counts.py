from datetime import datetime, timedelta
from unittest.mock import patch

from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationSamplingProjectSpanCountsTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.url = reverse(
            "sentry-api-0-organization-sampling-span-counts",
            kwargs={"organization_id_or_slug": self.org.slug},
        )

    def test_feature_flag_required(self):
        response = self.client.get(self.url)
        assert response.status_code == 404

    @patch("sentry.api.endpoints.organization_sampling_project_span_counts.run_queries")
    def test_get_span_counts(self, mock_run_queries):
        self.create_project(organization=self.org)
        mock_run_queries.return_value.apply_transformer.return_value = {
            "groups": [
                {
                    "by": {"project": "1", "target_project_id": "2"},
                    "totals": {"sum(c:spans/count_per_root_project@none)": 123},
                }
            ]
        }

        with self.feature("organizations:dynamic-sampling-custom"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "start": (datetime.now() - timedelta(hours=1)).isoformat(),
                    "end": datetime.now().isoformat(),
                    "interval": "1h",
                },
            )

        assert response.status_code == 200
        assert response.data == {
            "groups": [
                {
                    "by": {"project": "1", "target_project_id": "2"},
                    "totals": {"sum(c:spans/count_per_root_project@none)": 123},
                }
            ]
        }

    def test_missing_feature_flag(self):
        response = self.client.get(
            self.url,
            format="json",
            data={
                "start": (datetime.now() - timedelta(hours=1)).isoformat(),
                "end": datetime.now().isoformat(),
            },
        )

        assert response.status_code == 404
