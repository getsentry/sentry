from unittest.mock import patch

from slack_sdk.web.slack_response import SlackResponse


def mock_slack_response(
    method_name, body, status_code=200, http_verb="POST", api_url=None, req_args=None, headers=None
):
    if api_url is None:
        api_url = f"https://slack.com/api/{method_name}"

    return patch(
        f"slack_sdk.web.client.WebClient.{method_name}",
        return_value=SlackResponse(
            client=None,
            http_verb=http_verb,
            api_url=api_url,
            req_args=req_args or {},
            data=body,
            headers=headers or {},
            status_code=status_code,
        ),
    )
