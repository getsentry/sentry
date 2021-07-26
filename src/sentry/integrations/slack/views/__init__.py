from typing import Mapping

from django.urls import reverse
from django.views.decorators.cache import never_cache as django_never_cache

from sentry.models import Integration
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign
from sentry.utils.types import Any
from sentry.web.decorators import EndpointFunc

from ..client import SlackClient
from ..utils import logger


def never_cache(view_func: EndpointFunc) -> EndpointFunc:
    """TODO(mgaeta): Remove cast once Django has a typed version."""
    result: EndpointFunc = django_never_cache(view_func)
    return result


def build_linking_url(endpoint: str, **kwargs: Any) -> str:
    """TODO(mgaeta): Remove cast once sentry/utils/http.py is typed."""
    url: str = absolute_uri(reverse(endpoint, kwargs={"signed_params": sign(**kwargs)}))
    return url


def send_slack_response(
    integration: Integration, text: str, params: Mapping[str, str], command: str
) -> None:
    payload = {
        "replace_original": False,
        "response_type": "ephemeral",
        "text": text,
    }

    client = SlackClient()
    if params["response_url"]:
        path = params["response_url"]
        headers = {}

    else:
        # Command has been invoked in a DM, not as a slash command
        # we do not have a response URL in this case
        token = (
            integration.metadata.get("user_access_token") or integration.metadata["access_token"]
        )
        headers = {"Authorization": f"Bearer {token}"}
        payload["token"] = token
        payload["channel"] = params["slack_id"]
        path = "/chat.postMessage"

    try:
        client.post(path, headers=headers, data=payload, json=True)
    except ApiError as e:
        message = str(e)
        # If the user took their time to link their slack account, we may no
        # longer be able to respond, and we're not guaranteed able to post into
        # the channel. Ignore Expired url errors.
        #
        # XXX(epurkhiser): Yes the error string has a space in it.
        if message != "Expired url":
            log_message = (
                "slack.link-notify.response-error"
                if command == "link"
                else "slack.unlink-notify.response-error"
            )
            logger.error(log_message, extra={"error": message})
