from urllib.parse import urlencode

import pytest
import responses
from django.conf import settings
from django.test import override_settings
from django.urls import get_resolver, reverse
from rest_framework.response import Response

from sentry.silo.base import SiloLimit, SiloMode
from sentry.testutils.helpers.apigateway import ApiGatewayTestCase, verify_request_params
from sentry.testutils.helpers.response import close_streaming_response
from sentry.testutils.silo import control_silo_test
from sentry.utils import json


@control_silo_test(regions=[ApiGatewayTestCase.REGION], include_monolith_run=True)
class ApiGatewayTest(ApiGatewayTestCase):
    @responses.activate
    def test_simple(self) -> None:
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
    def test_proxy_does_not_resolve_redirect(self) -> None:
        responses.add(
            responses.POST,
            f"{self.REGION.address}/organizations/{self.organization.slug}/region/",
            headers={"Location": "https://zombo.com"},
            status=302,
        )

        url = reverse("region-endpoint", kwargs={"organization_slug": self.organization.slug})
        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            resp = self.client.post(url)
        assert resp.status_code == 302
        assert resp["Location"] == "https://zombo.com"

        if SiloMode.get_current_mode() == SiloMode.MONOLITH:
            assert resp.content == b""
        else:
            response_payload = close_streaming_response(resp)
            assert response_payload == b""

    @responses.activate
    def test_region_pinned_urls_are_defined(self) -> None:
        resolver = get_resolver()
        # Ensure that all urls in REGION_PINNED_URL_NAMES exist in api/urls.py
        for name in settings.REGION_PINNED_URL_NAMES:
            if "api" not in name:
                continue
            route = resolver.reverse_dict.get(name)
            assert (
                route
            ), f"REGION_PINNED_URL_NAMES contains {name}, but no route is registered with that name"

    @responses.activate
    def test_proxy_check_org_slug_url(self) -> None:
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
    def test_proxy_check_org_id_or_slug_url_with_params(self) -> None:
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
        responses.add(
            responses.GET,
            f"{self.REGION.address}/organizations/{self.organization.id}/region/",
            json={"proxy": True},
        )
        responses.add(
            responses.GET,
            f"{self.REGION.address}/organizations/{self.organization.id}/control/",
            json={"proxy": True},
        )

        region_url_slug = reverse(
            "region-endpoint-id-or-slug", kwargs={"organization_id_or_slug": self.organization.slug}
        )
        control_url_slug = reverse(
            "control-endpoint-id-or-slug",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

        region_url_id = reverse(
            "region-endpoint-id-or-slug", kwargs={"organization_id_or_slug": self.organization.id}
        )
        control_url_id = reverse(
            "control-endpoint-id-or-slug", kwargs={"organization_id_or_slug": self.organization.id}
        )

        with override_settings(SILO_MODE=SiloMode.CONTROL, MIDDLEWARE=tuple(self.middleware)):
            resp = self.client.get(region_url_slug)
            assert resp.status_code == 200
            resp_json = json.loads(close_streaming_response(resp))
            assert resp_json["proxy"] is True

            resp = self.client.get(control_url_slug)
            assert resp.status_code == 200
            assert resp.data["proxy"] is False

        with override_settings(SILO_MODE=SiloMode.REGION, MIDDLEWARE=tuple(self.middleware)):
            resp = self.client.get(region_url_slug)
            assert resp.status_code == 200
            assert resp.data["proxy"] is False

        with override_settings(SILO_MODE=SiloMode.CONTROL, MIDDLEWARE=tuple(self.middleware)):
            resp = self.client.get(region_url_id)
            assert resp.status_code == 200
            resp_json = json.loads(close_streaming_response(resp))
            assert resp_json["proxy"] is True

            resp = self.client.get(control_url_id)
            assert resp.status_code == 200
            assert resp.data["proxy"] is False

        with override_settings(SILO_MODE=SiloMode.REGION, MIDDLEWARE=tuple(self.middleware)):
            resp = self.client.get(region_url_id)
            assert resp.status_code == 200
            assert resp.data["proxy"] is False

    @responses.activate
    def test_proxy_check_region_pinned_url(self) -> None:
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
    def test_proxy_check_region_pinned_url_with_params(self) -> None:
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

    @responses.activate
    def test_proxy_check_region_pinned_issue_urls(self) -> None:
        issue = self.create_group()
        responses.add(
            responses.GET,
            f"{self.REGION.address}/issues/{issue.id}/",
            json={"proxy": True, "id": issue.id},
        )
        responses.add(
            responses.GET,
            f"{self.REGION.address}/issues/{issue.id}/events/",
            json={"proxy": True, "id": issue.id, "events": True},
        )

        # No /api/0 as we only include sentry.api.urls.urlpatterns
        # and not sentry.web.urls which includes the version prefix
        issue_details = f"/issues/{issue.id}/"
        issue_events = f"/issues/{issue.id}/events/"

        with override_settings(SILO_MODE=SiloMode.CONTROL, MIDDLEWARE=tuple(self.middleware)):
            resp = self.client.get(issue_details)
            assert resp.status_code == 200
            resp_json = json.loads(close_streaming_response(resp))
            assert resp_json["proxy"] is True
            assert resp_json["id"] == issue.id

            resp = self.client.get(issue_events)
            assert resp.status_code == 200
            resp_json = json.loads(close_streaming_response(resp))
            assert resp_json["proxy"] is True
            assert resp_json["events"]

    @responses.activate
    def test_proxy_error_embed_dsn(self) -> None:
        responses.add(
            responses.GET,
            f"{self.REGION.address}/api/embed/error-page/",
            json={"proxy": True, "name": "error-embed"},
        )
        with override_settings(SILO_MODE=SiloMode.CONTROL, MIDDLEWARE=tuple(self.middleware)):
            # no dsn
            with pytest.raises(SiloLimit.AvailabilityError):
                self.client.get("/api/embed/error-page/")

            # invalid dsn
            with pytest.raises(SiloLimit.AvailabilityError):
                self.client.get("/api/embed/error-page/", data={"dsn": "lolnope"})

            # invalid DSN that doesn't match our domain
            with pytest.raises(SiloLimit.AvailabilityError):
                self.client.get(
                    "/api/embed/error-page/", data={"dsn": "https://abc123@nope.com/123"}
                )

            # Older DSN with no region -> monolith region
            resp = self.client.get(
                "/api/embed/error-page/", data={"dsn": "https://abc123@testserver/123"}
            )
            assert resp.status_code == 200
            self._check_response(resp, "error-embed")

            # DSN with o123.ingest.sentry.io style hosts
            resp = self.client.get(
                "/api/embed/error-page/", data={"dsn": "https://abc123@o123.ingest.testserver/123"}
            )
            assert resp.status_code == 200
            self._check_response(resp, "error-embed")

            # DSN with o123.ingest.us.sentry.io style hosts
            resp = self.client.get(
                "/api/embed/error-page/",
                data={"dsn": "https://abc123@o123.ingest.us.testserver/123"},
            )
            assert resp.status_code == 200
            self._check_response(resp, "error-embed")

            # DSN with o123.ingest.us.sentry.io style hosts with a garbage region
            with pytest.raises(SiloLimit.AvailabilityError):
                self.client.get(
                    "/api/embed/error-page/",
                    data={"dsn": "https://abc123@o123.ingest.zz.testserver/123"},
                )

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
    def test_proxy_sentryapp_installation_path(self) -> None:
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
    def test_proxy_sentryapp_path(self) -> None:
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
        responses.add(
            responses.GET,
            f"{self.REGION.address}/sentry-apps/{sentry_app.id}/interaction/",
            json={"proxy": True, "name": "interaction"},
        )
        responses.add(
            responses.GET,
            f"{self.REGION.address}/sentry-apps/{sentry_app.id}/requests/",
            json={"proxy": True, "name": "requests"},
        )

        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            resp = self.client.get(f"/sentry-apps/{sentry_app.slug}/interaction/")
            self._check_response(resp, "interaction")

            resp = self.client.get(f"/sentry-apps/{sentry_app.slug}/requests/")
            self._check_response(resp, "requests")

            resp = self.client.get(f"/sentry-apps/{sentry_app.id}/interaction/")
            self._check_response(resp, "interaction")

            resp = self.client.get(f"/sentry-apps/{sentry_app.id}/requests/")
            self._check_response(resp, "requests")

    @responses.activate
    def test_proxy_sentryapp_installation_path_invalid(self) -> None:
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
