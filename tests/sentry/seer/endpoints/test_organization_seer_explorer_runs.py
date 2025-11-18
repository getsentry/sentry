from datetime import datetime
from unittest.mock import ANY, MagicMock, patch

import requests
from django.urls import reverse

from sentry.seer.explorer.client_models import ExplorerRun
from sentry.seer.models import SeerPermissionError
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.utils.cursors import Cursor


@with_feature("organizations:seer-explorer")
class TestOrganizationSeerExplorerRunsEndpoint(APITestCase):
    endpoint = "sentry-api-0-organization-seer-explorer-runs"

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.url = reverse(self.endpoint, args=[self.organization.slug])
        self.login_as(user=self.user)

        self.seer_access_patcher = patch(
            "sentry.seer.explorer.client_utils.has_seer_explorer_access_with_detail",
            return_value=(True, None),
        )
        self.seer_access_patcher.start()
        self.client_patcher = patch(
            "sentry.seer.endpoints.organization_seer_explorer_runs.SeerExplorerClient"
        )
        self.mock_client_class = self.client_patcher.start()
        self.mock_client = MagicMock()
        self.mock_client_class.return_value = self.mock_client

    def tearDown(self) -> None:
        self.seer_access_patcher.stop()
        self.client_patcher.stop()
        super().tearDown()

    def test_get_simple(self) -> None:
        self.mock_client.get_runs.return_value = [
            ExplorerRun(
                run_id=1,
                title="Run 1",
                last_triggered_at=datetime.now(),
                created_at=datetime.now(),
            ),
            ExplorerRun(
                run_id=2,
                title="Run 2",
                last_triggered_at=datetime.now(),
                created_at=datetime.now(),
            ),
        ]
        response = self.client.get(self.url)
        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) == 2
        assert data[0]["run_id"] == 1
        assert data[1]["run_id"] == 2

        self.mock_client_class.assert_called_once_with(self.organization, ANY)
        self.mock_client.get_runs.assert_called_once_with(
            category_key=None,
            category_value=None,
            offset=0,
            limit=101,  # Default per_page of 100 + 1 for has_more
        )

    def test_get_cursor_pagination(self) -> None:
        # Mock seer response for offset 0, limit 3.
        self.mock_client.get_runs.return_value = [
            ExplorerRun(
                run_id=1,
                title="Run 1",
                last_triggered_at=datetime.now(),
                created_at=datetime.now(),
            ),
            ExplorerRun(
                run_id=2,
                title="Run 2",
                last_triggered_at=datetime.now(),
                created_at=datetime.now(),
            ),
            ExplorerRun(
                run_id=3,
                title="Run 3",
                last_triggered_at=datetime.now(),
                created_at=datetime.now(),
            ),
        ]
        cursor = str(Cursor(0, 0))
        response = self.client.get(self.url + f"?per_page=2&cursor={cursor}")
        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) == 2
        assert data[0]["run_id"] == 1
        assert data[1]["run_id"] == 2
        assert 'rel="next"; results="true"' in response.headers["Link"]

        self.mock_client.get_runs.assert_called_once_with(
            category_key=None, category_value=None, offset=0, limit=3
        )

        # Second page - mock seer response for offset 2, limit 3.
        self.mock_client.get_runs.return_value = [
            ExplorerRun(
                run_id=3,
                title="Run 3",
                last_triggered_at=datetime.now(),
                created_at=datetime.now(),
            ),
            ExplorerRun(
                run_id=4,
                title="Run 4",
                last_triggered_at=datetime.now(),
                created_at=datetime.now(),
            ),
        ]
        cursor = str(Cursor(0, 2))
        response = self.client.get(self.url + f"?per_page=2&cursor={cursor}")
        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) == 2
        assert data[0]["run_id"] == 3
        assert data[1]["run_id"] == 4
        assert 'rel="next"; results="false"' in response.headers["Link"]

        # Verify second call
        assert self.mock_client.get_runs.call_count == 2
        call_args = self.mock_client.get_runs.call_args
        assert call_args.kwargs["offset"] == 2
        assert call_args.kwargs["limit"] == 3

    def test_get_with_seer_error(self) -> None:
        self.mock_client.get_runs.side_effect = requests.HTTPError("API Error")
        response = self.client.get(self.url)
        assert response.status_code == 500

    def test_get_with_category_key_filter(self) -> None:
        self.mock_client.get_runs.return_value = [
            ExplorerRun(
                run_id=1,
                title="Run 1",
                last_triggered_at=datetime.now(),
                created_at=datetime.now(),
                category_key="bug-fixer",
                category_value=None,
            ),
        ]
        response = self.client.get(self.url + "?category_key=bug-fixer")
        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) == 1
        assert data[0]["run_id"] == 1

        call_args = self.mock_client.get_runs.call_args
        assert call_args.kwargs["category_key"] == "bug-fixer"
        assert call_args.kwargs["category_value"] is None

    def test_get_with_category_value_filter(self) -> None:
        self.mock_client.get_runs.return_value = [
            ExplorerRun(
                run_id=2,
                title="Run 2",
                last_triggered_at=datetime.now(),
                created_at=datetime.now(),
                category_key=None,
                category_value="issue-123",
            ),
        ]
        response = self.client.get(self.url + "?category_value=issue-123")
        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) == 1
        assert data[0]["run_id"] == 2

        call_args = self.mock_client.get_runs.call_args
        assert call_args.kwargs["category_key"] is None
        assert call_args.kwargs["category_value"] == "issue-123"

    def test_get_with_both_category_filters(self) -> None:
        self.mock_client.get_runs.return_value = [
            ExplorerRun(
                run_id=3,
                title="Run 3",
                last_triggered_at=datetime.now(),
                created_at=datetime.now(),
                category_key="bug-fixer",
                category_value="issue-123",
            ),
        ]
        response = self.client.get(self.url + "?category_key=bug-fixer&category_value=issue-123")
        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) == 1
        assert data[0]["run_id"] == 3

        call_args = self.mock_client.get_runs.call_args
        assert call_args.kwargs["category_key"] == "bug-fixer"
        assert call_args.kwargs["category_value"] == "issue-123"

    def test_get_with_category_filters_and_pagination(self) -> None:
        self.mock_client.get_runs.return_value = [
            ExplorerRun(
                run_id=1,
                title="Run 1",
                last_triggered_at=datetime.now(),
                created_at=datetime.now(),
                category_key="bug-fixer",
                category_value="issue-123",
            ),
            ExplorerRun(
                run_id=2,
                title="Run 2",
                last_triggered_at=datetime.now(),
                created_at=datetime.now(),
                category_key="bug-fixer",
                category_value="issue-123",
            ),
        ]
        cursor = str(Cursor(0, 0))
        response = self.client.get(
            self.url
            + "?category_key=bug-fixer&category_value=issue-123&per_page=2&cursor="
            + cursor
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) == 2

        call_args = self.mock_client.get_runs.call_args
        assert call_args.kwargs["category_key"] == "bug-fixer"
        assert call_args.kwargs["category_value"] == "issue-123"
        assert call_args.kwargs["limit"] == 3  # +1 for has_more
        assert call_args.kwargs["offset"] == 0


class TestOrganizationSeerExplorerRunsEndpointFeatureFlags(APITestCase):
    endpoint = "sentry-api-0-organization-seer-explorer-runs"

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.url = reverse(self.endpoint, args=[self.organization.slug])
        self.login_as(user=self.user)

    def test_missing_gen_ai_features_flag(self) -> None:
        with self.feature({"organizations:seer-explorer": True}):
            with patch(
                "sentry.seer.endpoints.organization_seer_explorer_runs.SeerExplorerClient",
                side_effect=SeerPermissionError("Feature flag not enabled"),
            ):
                response = self.client.get(self.url)
                assert response.status_code == 403
                assert response.data == {"detail": "Feature flag not enabled"}

    def test_missing_seer_explorer_flag(self) -> None:
        with self.feature({"organizations:gen-ai-features": True}):
            with patch(
                "sentry.seer.endpoints.organization_seer_explorer_runs.SeerExplorerClient",
                side_effect=SeerPermissionError("Feature flag not enabled"),
            ):
                response = self.client.get(self.url)
                assert response.status_code == 403
                assert response.data == {"detail": "Feature flag not enabled"}

    def test_missing_seer_acknowledgement(self) -> None:
        with self.feature(
            {"organizations:gen-ai-features": True, "organizations:seer-explorer": True}
        ):
            with patch(
                "sentry.seer.endpoints.organization_seer_explorer_runs.SeerExplorerClient",
                side_effect=SeerPermissionError(
                    "Seer has not been acknowledged by the organization."
                ),
            ):
                response = self.client.get(self.url)
                assert response.status_code == 403
                assert response.data == {
                    "detail": "Seer has not been acknowledged by the organization."
                }

    def test_missing_allow_joinleave_org_flag(self) -> None:
        with self.feature(
            {"organizations:gen-ai-features": True, "organizations:seer-explorer": True}
        ):
            with patch(
                "sentry.seer.endpoints.organization_seer_explorer_runs.SeerExplorerClient",
                side_effect=SeerPermissionError(
                    "Organization does not have open team membership enabled. Seer requires this to aggregate context across all projects and allow members to ask questions freely."
                ),
            ):
                response = self.client.get(self.url)
                assert response.status_code == 403
                assert response.data == {
                    "detail": "Organization does not have open team membership enabled. Seer requires this to aggregate context across all projects and allow members to ask questions freely."
                }
