from unittest.mock import patch

from django.urls import reverse
from rest_framework import status

from sentry.tasks.check_am2_compatibility import CheckStatus, set_check_results, set_check_status
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class AdminRelayProjectConfigsEndpointTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.owner = self.create_user(
            email="example@example.com", is_superuser=False, is_staff=True, is_active=True
        )
        self.org = self.create_organization(owner=self.owner)
        self.first_team = self.create_team(organization=self.org)
        self.project_1 = self.create_project(
            name="project_1", organization=self.org, teams=[self.first_team]
        )
        self.superuser = self.create_user(
            "superuser@example.com", is_superuser=True, is_staff=True, is_active=True
        )
        self.path = "sentry-api-0-internal-check-am2-compatibility"

    def get_url(self, org_id):
        ret_val = reverse(self.path)
        ret_val += f"?orgId={org_id}"

        return ret_val

    @patch(
        "sentry.tasks.check_am2_compatibility.CheckAM2Compatibility.run_compatibility_check",
        return_value={},
    )
    def test_check_endpoint_results_with_superuser_permissions_and_no_cached_value(
        self, run_compatibility_check
    ):
        self.login_as(self.superuser, superuser=True)

        url = self.get_url(self.org.id)

        with self.tasks():
            response = self.client.get(url)

        assert response.data["status"] == CheckStatus.IN_PROGRESS.value
        assert response.status_code == status.HTTP_202_ACCEPTED
        run_compatibility_check.assert_called_once()

    def test_check_endpoint_results_with_superuser_permissions_and_in_progress_cached_value(self):
        self.login_as(self.superuser, superuser=True)

        url = self.get_url(self.org.id)
        set_check_status(self.org.id, CheckStatus.ERROR)
        with self.tasks():
            response = self.client.get(url)

        assert response.data["status"] == CheckStatus.ERROR.value
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

    def test_check_endpoint_results_with_superuser_permissions_and_done_cached_value(self):
        self.login_as(self.superuser, superuser=True)

        results = {"results": {"widgets": [], "alerts": [], "sdsks": {}}, "errors": []}

        url = self.get_url(self.org.id)
        set_check_status(self.org.id, CheckStatus.DONE)
        set_check_results(self.org.id, results)
        with self.tasks():
            response = self.client.get(url)

        assert response.data["status"] == CheckStatus.DONE.value
        assert response.data["results"] == results["results"]
        assert response.data["errors"] == []
        assert response.status_code == status.HTTP_200_OK

    def test_check_endpoint_results_without_superuser_permissions(self):
        self.login_as(self.owner)

        url = self.get_url(self.org.id)
        response = self.client.get(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN
