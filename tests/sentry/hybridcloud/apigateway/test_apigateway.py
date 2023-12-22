from urllib.parse import urlencode

import responses
from django.test import override_settings
from django.urls import reverse
from rest_framework.response import Response

from sentry.silo import SiloMode
from sentry.testutils.helpers.apigateway import ApiGatewayTestCase, verify_request_params
from sentry.testutils.helpers.response import close_streaming_response
from sentry.testutils.silo import control_silo_test
from sentry.utils import json


@control_silo_test(regions=[ApiGatewayTestCase.REGION], include_monolith_run=True)
class ApiGatewayTest(ApiGatewayTestCase):
    @responses.activate
    def test_simple(self):
        query_params = dict(foo="test", bar=["one", "two"])
        headers = dict(example="this")
        responses.add_callback(
            responses.GET,
            f"{self.REGION.address}/organizations/{self.organization.slug}/region/",
            verify_request_params(query_params, headers),
        )

        base_url = reverse("region-endpoint", kwargs={"organization_slug": self.organization.slug})
        encoded_params = urlencode(query_params, doseq=True)
        url = f"{base_url}?{encoded_params}"
        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            resp = self.client.get(url, headers=headers)
        assert resp.status_code == 200, resp.content

        if SiloMode.get_current_mode() == SiloMode.MONOLITH:
            resp_json = json.loads(resp.content)
            assert resp_json["proxy"] is False
        else:
            resp_json = json.loads(close_streaming_response(resp))
            assert resp_json["proxy"] is True

    @responses.activate
    def test_proxy_check_org_slug_url(self):
        """Test the logic of when a request should be proxied"""
        responses.add(
            responses.GET,
            f"{self.REGION.address}/organizations/{self.organization.slug}/region/",
            json={"proxy": True},
        )
        responses.add(
            responses.GET,
            f"{self.REGION.address}/organizations/{self.organization.slug}/control/",
            json={"proxy": True},
        )

        region_url = reverse(
            "region-endpoint", kwargs={"organization_slug": self.organization.slug}
        )
        control_url = reverse(
            "control-endpoint", kwargs={"organization_slug": self.organization.slug}
        )

        with override_settings(SILO_MODE=SiloMode.CONTROL, MIDDLEWARE=tuple(self.middleware)):
            resp = self.client.get(region_url)
            assert resp.status_code == 200
            resp_json = json.loads(close_streaming_response(resp))
            assert resp_json["proxy"] is True

            resp = self.client.get(control_url)
            assert resp.status_code == 200
            assert resp.data["proxy"] is False

        with override_settings(SILO_MODE=SiloMode.REGION, MIDDLEWARE=tuple(self.middleware)):
            resp = self.client.get(region_url)
            assert resp.status_code == 200
            assert resp.data["proxy"] is False

    @responses.activate
    def test_proxy_check_region_pinned_url(self):
        responses.add(
            responses.GET,
            f"{self.REGION.address}/builtin-symbol-sources/",
            json={"proxy": True},
        )

        # No /api/0 as we only include sentry.api.urls.urlpatterns
        # and not sentry.web.urls which includes the version prefix
        region_pinned = "/builtin-symbol-sources/"
        control_url = reverse(
            "control-endpoint", kwargs={"organization_slug": self.organization.slug}
        )

        with override_settings(SILO_MODE=SiloMode.CONTROL, MIDDLEWARE=tuple(self.middleware)):
            resp = self.client.get(region_pinned)
            assert resp.status_code == 200
            resp_json = json.loads(close_streaming_response(resp))
            assert resp_json["proxy"] is True

            resp = self.client.get(control_url)
            assert resp.status_code == 200
            assert resp.data["proxy"] is False

    @responses.activate
    def test_proxy_check_region_pinned_url_with_params(self):
        responses.add(
            responses.GET,
            f"{self.REGION.address}/relays/register/",
            json={"proxy": True},
        )
        responses.add(
            responses.GET,
            f"{self.REGION.address}/relays/abc123/",
            json={"proxy": True, "details": True},
        )

        with override_settings(SILO_MODE=SiloMode.CONTROL, MIDDLEWARE=tuple(self.middleware)):
            resp = self.client.get("/relays/register/")
            assert resp.status_code == 200
            resp_json = json.loads(close_streaming_response(resp))
            assert resp_json["proxy"] is True

            resp = self.client.get("/relays/abc123/")
            assert resp.status_code == 200
            resp_json = json.loads(close_streaming_response(resp))
            assert resp_json["proxy"] is True
            assert resp_json["details"] is True

    @staticmethod
    def _check_response(resp: Response, expected_name: str) -> None:
        if SiloMode.get_current_mode() == SiloMode.MONOLITH:
            assert resp.status_code == 401
            return
        assert resp.status_code == 200
        resp_json = json.loads(close_streaming_response(resp))
        assert resp_json["proxy"] is True
        assert resp_json["name"] == expected_name

    @responses.activate
    def test_proxy_sentryapp_installation_path(self):
        sentry_app = self.create_sentry_app()
        install = self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization
        )

        responses.add(
            responses.GET,
            f"{self.REGION.address}/sentry-app-installations/{install.uuid}/external-requests/",
            json={"proxy": True, "name": "external-requests"},
        )
        responses.add(
            responses.GET,
            f"{self.REGION.address}/sentry-app-installations/{install.uuid}/external-issues/",
            json={"proxy": True, "name": "external-issues"},
        )
        responses.add(
            responses.GET,
            f"{self.REGION.address}/sentry-app-installations/{install.uuid}/external-issue-actions/",
            json={"proxy": True, "name": "external-issue-actions"},
        )

        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            resp = self.client.get(f"/sentry-app-installations/{install.uuid}/external-requests/")
            self._check_response(resp, "external-requests")

            resp = self.client.get(f"/sentry-app-installations/{install.uuid}/external-issues/")
            self._check_response(resp, "external-issues")

            resp = self.client.get(
                f"/sentry-app-installations/{install.uuid}/external-issue-actions/"
            )
            self._check_response(resp, "external-issue-actions")

    @responses.activate
    def test_proxy_sentryapp_path(self):
        sentry_app = self.create_sentry_app()

        responses.add(
            responses.GET,
            f"{self.REGION.address}/sentry-apps/{sentry_app.slug}/interaction/",
            json={"proxy": True, "name": "interaction"},
        )
        responses.add(
            responses.GET,
            f"{self.REGION.address}/sentry-apps/{sentry_app.slug}/requests/",
            json={"proxy": True, "name": "requests"},
        )

        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            resp = self.client.get(f"/sentry-apps/{sentry_app.slug}/interaction/")
            self._check_response(resp, "interaction")

            resp = self.client.get(f"/sentry-apps/{sentry_app.slug}/requests/")
            self._check_response(resp, "requests")

    @responses.activate
    def test_proxy_sentryapp_installation_path_invalid(self):
        if SiloMode.get_current_mode() == SiloMode.MONOLITH:
            return

        # No responses configured so that requests will fail if they are made.
        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            resp = self.client.get("/sentry-app-installations/abc123/external-requests/")
            assert resp.status_code == 404

            resp = self.client.get("/sentry-app-installations/abc123/external-issues/")
            assert resp.status_code == 404

            resp = self.client.get("/sentry-app-installations/abc123/external-issue-actions/")
            assert resp.status_code == 404
