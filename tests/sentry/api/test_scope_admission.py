from typing import Any
from unittest import mock

from sentry.api.client_kind import FEATURE_FLAG
from sentry.testutils.cases import APITestCase


class ScopeAdmissionTest(APITestCase):
    """The scopes that admitted a request ride along on the `api.attribution` span."""

    def span_data_for(self, url: str, **request_kwargs: Any) -> dict[str, str]:
        with (
            self.feature(FEATURE_FLAG),
            mock.patch("sentry.api.client_kind.set_span_data") as set_span_data,
        ):
            assert self.client.get(url, **request_kwargs).status_code == 200
        return {call.args[1]: call.args[2] for call in set_span_data.call_args_list}

    def test_session_request_records_the_scopes_the_role_supplied(self) -> None:
        self.login_as(self.user)
        url = f"/api/0/organizations/{self.organization.slug}/"

        data = self.span_data_for(url)

        # The owner holds every scope the endpoint accepts for GET.
        assert data["scopes_satisfying"] == "org:admin,org:read,org:write"
        assert data["scopes_allowed"] == "org:admin,org:read,org:write"

    def test_token_request_records_only_the_scopes_the_token_held(self) -> None:
        token = self.create_user_auth_token(user=self.user, scope_list=["org:read"])
        url = f"/api/0/organizations/{self.organization.slug}/"

        data = self.span_data_for(url, HTTP_AUTHORIZATION=f"Bearer {token.token}")

        # This is the request that would break if org:read left the scope map.
        assert data["scopes_satisfying"] == "org:read"
        assert data["scopes_allowed"] == "org:admin,org:read,org:write"

    def test_project_endpoint_records_project_scopes(self) -> None:
        self.login_as(self.user)
        url = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/"

        data = self.span_data_for(url)

        assert "project:read" in data["scopes_satisfying"]

    def test_nothing_recorded_without_the_attribution_span(self) -> None:
        self.login_as(self.user)
        url = f"/api/0/organizations/{self.organization.slug}/"

        with (
            self.feature({FEATURE_FLAG: False}),
            mock.patch("sentry.api.client_kind.set_span_data") as set_span_data,
        ):
            assert self.client.get(url).status_code == 200

        assert set_span_data.call_args_list == []
