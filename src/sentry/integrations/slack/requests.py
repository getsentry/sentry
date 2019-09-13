from __future__ import absolute_import

from sentry import options
from sentry.models import Integration
from sentry.utils import json
from sentry.utils.cache import memoize

from .utils import logger


class SlackRequestError(Exception):
    """
    Something was invalid about the request from Slack.

    Includes the status the endpoint should return, based on the error.
    """

    def __init__(self, status):
        self.status = status


class SlackRequest(object):
    """
    Encapsulation of a request from Slack.

    Action and Event requests share much of the same validation needs and data
    access characteristics.

    Raises ``SlackRequestError`` if the request in invalid in some way (the
    payload missing, it not being JSON, etc.) ``SlackRequestError`` will also
    have the appropriate response code the endpoint should respond with, for
    the error that was raised.
    """

    def __init__(self, request):
        self.request = request
        self.integration = None
        self._data = {}
        self._log_request()

    def validate(self):
        """
        Ensure everything is present to properly process this request
        """
        self._authorize()
        self._validate_data()
        self._validate_integration()

    def is_challenge(self):
        return False

    @property
    def type(self):
        # Found in different places, so this is implemented in each request's
        # specific object (``SlackEventRequest`` and ``SlackActionRequest``).
        raise NotImplementedError

    @property
    def team_id(self):
        """
        Provide a normalized interface to ``team_id``, which Action and Event
        requests provide in different places.
        """
        return self.data.get("team_id") or self.data.get("team", {}).get("id")

    @property
    def data(self):
        if not self._data:
            self._validate_data()
        return self._data

    @property
    def logging_data(self):
        data = {
            "slack_team_id": self.team_id,
            "slack_channel_id": self.data.get("channel", {}).get("id"),
            "slack_user_id": self.data.get("user", {}).get("id"),
            "slack_event_id": self.data.get("event_id"),
            "slack_callback_id": self.data.get("callback_id"),
            "slack_api_app_id": self.data.get("api_app_id"),
        }

        if self.integration:
            data["integration_id"] = self.integration.id

        return dict((k, v) for k, v in data.items() if v)

    def _validate_data(self):
        try:
            self._data = self.request.data
        except (ValueError, TypeError):
            raise SlackRequestError(status=400)

    def _authorize(self):
        if self.data.get("token") != options.get("slack.verification-token"):
            self._error("slack.action.invalid-token")
            raise SlackRequestError(status=401)

    def _validate_integration(self):
        try:
            self.integration = Integration.objects.get(provider="slack", external_id=self.team_id)
        except Integration.DoesNotExist:
            self._error("slack.action.invalid-team-id")
            raise SlackRequestError(status=403)

    def _log_request(self):
        self._info("slack.request")

    def _error(self, key):
        logger.error(key, extra=self.logging_data)

    def _info(self, key):
        logger.info(key, extra=self.logging_data)


class SlackEventRequest(SlackRequest):
    """
    An Event request sent from Slack.

    These requests require the same Data and Token validation as all other
    requests from Slack, but also event data validation.

    Challenge Requests
    ------------------
    Slack Event requests first start with a "challenge request". This is just a
    request Sentry needs to verifying using it's shared key.

    Challenge requests will have a ``type`` of ``url_verification``.
    """

    def validate(self):
        if self.is_challenge():
            # Challenge requests only include the Token and data to verify the
            # request, so only validate those.
            self._authorize()
            self._validate_data()
        else:
            # Non-Challenge requests need to validate everything plus the data
            # about the event.
            super(SlackEventRequest, self).validate()
            self._validate_event()

    def is_challenge(self):
        return self.data.get("type") == "url_verification"

    @property
    def type(self):
        return self.data.get("event", {}).get("type")

    def _validate_event(self):
        if not self.data.get("event"):
            self._error("slack.event.invalid-event-data")
            raise SlackRequestError(status=400)

        if not self.data.get("event", {}).get("type"):
            self._error("slack.event.invalid-event-type")
            raise SlackRequestError(status=400)

    def _log_request(self):
        self._info(u"slack.event.{}".format(self.type))


class SlackActionRequest(SlackRequest):
    """
    An Action request sent from Slack.

    Action requests nest their data inside of a ``payload`` key in the request
    body, for some reason. Therefor they require an extra bit of data
    validation.
    """

    def __init__(self, request):
        super(SlackActionRequest, self).__init__(request)
        self._callback_data = None

    @property
    def type(self):
        return self.data.get("type")

    @memoize
    def callback_data(self):
        """
        We store certain data in ``callback_id`` as JSON. It's a bit hacky, but
        it's the simplest way to store state without saving it on the Sentry
        side.

        Data included in this field:
            - issue: the ID of the corresponding Issue
            - orig_response_url: URL from the original message we received
            - is_message: did the original message have a 'message' type
        """
        return json.loads(self.data.get("callback_id"))

    def _validate_data(self):
        """
        Action requests provide the body of the request differently than Event
        requests (nested in a ``payload`` attribute), so there's extra
        validation needed.
        """
        super(SlackActionRequest, self)._validate_data()

        if "payload" not in self.request.data:
            raise SlackRequestError(status=400)

        try:
            self._data = json.loads(self.data["payload"])
        except (KeyError, IndexError, TypeError, ValueError):
            raise SlackRequestError(status=400)

    def _log_request(self):
        self._info("slack.action")
