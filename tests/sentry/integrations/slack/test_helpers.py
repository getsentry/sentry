from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from unittest.mock import patch
from urllib.parse import parse_qs, urlencode, urlparse

import responses
from slack_sdk.web import SlackResponse

from sentry.testutils.cases import IntegrationTestCase


def assert_slack_setup_flow(
    test_case: IntegrationTestCase,
    team_id: str = "TXXXXXXX1",
    authorizing_user_id: str = "UXXXXXXX1",
    expected_client_id: str = "slack-client-id",
    expected_client_secret: str = "slack-client-secret",
    customer_domain: str | None = None,
    init_params: Mapping[str, str] | None = None,
) -> None:
    responses.reset()

    extra_kwargs: dict[str, Any] = {}
    if customer_domain:
        extra_kwargs["HTTP_HOST"] = customer_domain

    init_path = test_case.init_path
    if init_params:
        init_path = f"{init_path}?{urlencode(init_params)}"

    resp = test_case.client.get(init_path, **extra_kwargs)
    assert resp.status_code == 302
    redirect = urlparse(resp["Location"])
    assert redirect.scheme == "https"
    assert redirect.netloc == "slack.com"
    assert redirect.path == "/oauth/v2/authorize"
    params = parse_qs(redirect.query)
    scopes = test_case.provider.identity_oauth_scopes
    assert params["scope"] == [" ".join(scopes)]
    assert params["state"]
    assert params["redirect_uri"] == ["http://testserver/extensions/slack/setup/"]
    assert params["response_type"] == ["code"]
    assert params["client_id"] == [expected_client_id]

    assert params.get("user_scope") == [" ".join(test_case.provider.user_scopes)]
    # once we've asserted on it, switch to singular values to make life easier
    authorize_params = {k: v[0] for k, v in params.items()}

    access_json = {
        "ok": True,
        "access_token": "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
        "scope": ",".join(sorted(test_case.provider.identity_oauth_scopes)),
        "team": {"id": team_id, "name": "Example"},
        "authed_user": {"id": authorizing_user_id},
    }
    responses.add(responses.POST, "https://slack.com/api/oauth.v2.access", json=access_json)

    response_json = {
        "ok": True,
        "members": [
            {
                "id": authorizing_user_id,
                "team_id": team_id,
                "deleted": False,
                "profile": {
                    "email": test_case.user.email,
                    "team": team_id,
                },
            },
        ],
        "response_metadata": {"next_cursor": ""},
    }
    with patch(
        "slack_sdk.web.client.WebClient.users_list",
        return_value=SlackResponse(
            client=None,
            http_verb="GET",
            api_url="https://slack.com/api/users.list",
            req_args={},
            data=response_json,
            headers={},
            status_code=200,
        ),
    ) as mock_post:
        test_case.mock_post = mock_post  # type: ignore[attr-defined]
        resp = test_case.client.get(
            "{}?{}".format(
                test_case.setup_path,
                urlencode({"code": "oauth-code", "state": authorize_params["state"]}),
            )
        )

        if customer_domain:
            assert resp.status_code == 302
            assert resp["Location"].startswith(f"http://{customer_domain}/extensions/slack/setup/")
            resp = test_case.client.get(resp["Location"], **extra_kwargs)

    mock_request = responses.calls[0].request
    req_params = parse_qs(mock_request.body)
    assert req_params["grant_type"] == ["authorization_code"]
    assert req_params["code"] == ["oauth-code"]
    assert req_params["redirect_uri"] == ["http://testserver/extensions/slack/setup/"]
    assert req_params["client_id"] == [expected_client_id]
    assert req_params["client_secret"] == [expected_client_secret]

    assert resp.status_code == 200
    test_case.assertDialogSuccess(resp)
