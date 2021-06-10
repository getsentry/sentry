import logging
from typing import Any, List, Mapping
from urllib.parse import parse_qs

from django.http import HttpResponse, HttpResponseNotAllowed
from rest_framework import status
from rest_framework.request import Request

from sentry.api.base import Endpoint
from sentry.integrations.slack.message_builder.help import build_help_attachment
from sentry.integrations.slack.requests import SlackEventRequest, SlackRequestError
from sentry.utils import json

logger = logging.getLogger("sentry.integrations.slack")

ALLOWED_METHODS = ["POST"]

# TODO MARCOS 1
def link(external_id: str) -> None:
    # handle already linked
    pass


# TODO MARCOS 2
def unlink(external_id: str) -> None:
    # TODO MARCOS how secure is this?
    pass


def validate_signature(request: Request) -> None:
    signature = request.META.get("HTTP_X_SLACK_SIGNATURE")
    if not signature:
        raise Exception("TODO validate_signature")


def get_payload(request: Request) -> Mapping[str, List[str]]:
    try:
        return parse_qs(request.body.decode("utf-8"), strict_parsing=True)
    except ValueError:
        logger.info("slack.webhook.invalid-payload", extra={"todo": "marcos"})
        return HttpResponse(status=status.HTTP_400_BAD_REQUEST)


def respond(data: Mapping[str, Any]) -> HttpResponse:
    return HttpResponse(
        json.dumps({"blocks": [data]}),
        content_type="application/json",
        status=status.HTTP_200_OK,
    )


def get_command(payload: Mapping[str, List[str]]) -> str:
    text = payload.get("text", [""])[0]
    return text.split(" ")[0].lower()


def get_external_id(payload: Mapping[str, List[str]]) -> str:
    # TODO MARCOS is this the right external_id?
    return payload.get("channel_id", [""])[0]


class SlackCommandsEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()
    auth_required = False
    csrf_protect = False

    def handle(self, request: Request) -> HttpResponse:
        """
        TODO MARCOS DESCRIBE
        TODO `X-Slack-Signature`
        Slack commands are all sent to one URL.
        """
        if request.method not in ALLOWED_METHODS:
            return HttpResponseNotAllowed(ALLOWED_METHODS)

        try:
            slack_request = SlackEventRequest(request)
            slack_request.validate()
        except SlackRequestError as e:
            return self.respond(status=e.status)

        payload = get_payload(request)
        command = get_command(payload)

        if command in ["help", ""]:
            return respond(build_help_attachment())

        external_id = get_external_id(payload)
        if command == "link":
            link()
            return respond({})

        if command == "unlink":
            unlink()
            return respond({})

        # If we cannot interpret the command, print help text.
        return respond(build_help_attachment(command))
