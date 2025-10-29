from unittest.mock import patch

import orjson
from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


@with_feature("organizations:seer-explorer")
class TestOrganizationSeerExplorerRunsEndpoint(APITestCase):
    endpoint = "sentry-api-0-organization-seer-explorer-runs"

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.url = reverse(self.endpoint, args=[self.organization.slug])
        self.login_as(user=self.user)

        self.seer_access_patcher = patch(
            "sentry.seer.endpoints.organization_seer_explorer_runs.has_seer_access_with_detail",
            return_value=(True, None),
        )
        self.seer_access_patcher.start()
        self.make_seer_request_patcher = patch(
            "sentry.seer.endpoints.organization_seer_explorer_runs.make_signed_seer_api_request"
        )
        self.make_seer_request = self.make_seer_request_patcher.start()

    def tearDown(self) -> None:
        self.seer_access_patcher.stop()
        self.make_seer_request_patcher.stop()
        super().tearDown()

    def test_get_simple(self) -> None:
        self.make_seer_request.return_value.status = 200
        self.make_seer_request.return_value.json.return_value = {
            "hello": "world",
        }
        response = self.client.get(self.url)
        assert response.status_code == 200
        assert response.json() == {"hello": "world"}

        self.make_seer_request.assert_called_once()
        call_args = self.make_seer_request.call_args
        assert call_args[0][1] == "/v1/automation/explorer/runs"
        body_json = orjson.loads(call_args[0][2])
        assert body_json == {
            "organization_id": self.organization.id,
            "user_id": self.user.id,
            "limit": None,
        }

    def test_get_with_limit(self) -> None:
        self.make_seer_request.return_value.status = 200
        self.make_seer_request.return_value.json.return_value = {
            "hello": "world",
        }
        response = self.client.get(self.url + "?limit=11")
        assert response.status_code == 200
        assert response.json() == {"hello": "world"}

        self.make_seer_request.assert_called_once()
        call_args = self.make_seer_request.call_args
        assert call_args[0][1] == "/v1/automation/explorer/runs"
        body_json = orjson.loads(call_args[0][2])
        assert body_json == {
            "organization_id": self.organization.id,
            "user_id": self.user.id,
            "limit": 11,
        }

    def test_get_with_invalid_limit(self) -> None:
        response = self.client.get(self.url + "?limit=invalid")
        assert response.status_code == 400
        assert "limit" in response.json()

    def test_get_with_seer_error(self) -> None:
        self.make_seer_request.return_value.status = 500
        response = self.client.get(self.url)
        assert response.status_code == 502


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
                "sentry.seer.seer_setup.get_seer_org_acknowledgement",
                return_value=True,
            ):
                response = self.client.get(self.url)
                assert response.status_code == 403
                assert response.data == {"detail": "Feature flag not enabled"}

    def test_missing_seer_explorer_flag(self) -> None:
        with self.feature({"organizations:gen-ai-features": True}):
            with patch(
                "sentry.seer.seer_setup.get_seer_org_acknowledgement",
                return_value=True,
            ):
                response = self.client.get(self.url)
                assert response.status_code == 403
                assert response.data == {"detail": "Feature flag not enabled"}

    def test_missing_seer_acknowledgement(self) -> None:
        with self.feature(
            {"organizations:gen-ai-features": True, "organizations:seer-explorer": True}
        ):
            with patch(
                "sentry.seer.seer_setup.get_seer_org_acknowledgement",
                return_value=False,
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
                "sentry.seer.seer_setup.get_seer_org_acknowledgement",
                return_value=True,
            ):
                self.organization.flags.allow_joinleave = False
                self.organization.save()
                response = self.client.get(self.url)
                assert response.status_code == 403
                assert response.data == {
                    "detail": "Organization does not have open team membership enabled. Seer requires this to aggregate context across all projects and allow members to ask questions freely."
                }
