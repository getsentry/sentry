from typing import Any
from unittest import mock

from django.test import RequestFactory

from sentry.api.client_kind import FEATURE_FLAG
from sentry.api.scope_version import get_scope_version, record_scope_version
from sentry.testutils.cases import APITestCase, TestCase


class ScopeVersionMetricTest(APITestCase):
    """Each admitted request counts toward `api.scope_version`, tagged by route and client kind."""

    def metric_tags_for(self, url: str, **request_kwargs: Any) -> list[dict[str, str]]:
        with (
            self.feature(FEATURE_FLAG),
            mock.patch("sentry.api.client_kind.metrics.incr") as incr,
        ):
            assert self.client.get(url, **request_kwargs).status_code == 200
        return [
            call.kwargs["tags"]
            for call in incr.call_args_list
            if call.args[0] == "api.scope_version"
        ]

    def test_session_request_is_v1(self) -> None:
        self.login_as(self.user)
        url = f"/api/0/organizations/{self.organization.slug}/"

        assert self.metric_tags_for(url) == [
            {
                "http.route": "/api/0/organizations/{organization_id_or_slug}/",
                "client_kind": "frontend",
                "scope_version": "v1",
            }
        ]

    def test_deprecated_scope_token_is_v1(self) -> None:
        token = self.create_user_auth_token(user=self.user, scope_list=["org:read"])
        url = f"/api/0/organizations/{self.organization.slug}/"

        tags = self.metric_tags_for(url, HTTP_AUTHORIZATION=f"Bearer {token.token}")

        assert tags == [
            {
                "http.route": "/api/0/organizations/{organization_id_or_slug}/",
                "client_kind": "unknown",
                "scope_version": "v1",
            }
        ]

    def test_project_endpoint_is_recorded(self) -> None:
        self.login_as(self.user)
        url = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/"

        [tags] = self.metric_tags_for(url)

        assert tags["scope_version"] == "v1"

    def test_nothing_recorded_without_the_attribution_span(self) -> None:
        self.login_as(self.user)
        url = f"/api/0/organizations/{self.organization.slug}/"

        with (
            self.feature({FEATURE_FLAG: False}),
            mock.patch("sentry.api.client_kind.metrics.incr") as incr,
        ):
            assert self.client.get(url).status_code == 200

        assert not any(call.args[0] == "api.scope_version" for call in incr.call_args_list)


class RecordScopeVersionTest(TestCase):
    def version_for(self, allowed: list[str], granted: list[str]) -> str | None:
        request = RequestFactory().get("/")
        record_scope_version(request, allowed, granted)
        return get_scope_version(request)

    def test_admitted_by_a_deprecated_scope_is_v1(self) -> None:
        for scope in ("org:read", "project:read", "member:read"):
            assert self.version_for([scope, "org:write"], [scope]) == "v1"

    def test_admitted_without_a_deprecated_scope_is_v2(self) -> None:
        assert self.version_for(["org:read", "dashboard:read"], ["dashboard:read"]) == "v2"
        assert self.version_for(["org:read", "org:write"], ["org:write"]) == "v2"

    def test_any_deprecated_scope_in_the_satisfying_set_is_v1(self) -> None:
        allowed = ["org:read", "dashboard:read"]
        assert self.version_for(allowed, ["org:read", "dashboard:read"]) == "v1"

    def test_not_admitted_records_nothing(self) -> None:
        assert self.version_for(["org:write"], ["org:read"]) is None
