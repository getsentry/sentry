from rest_framework.request import Request

from sentry.integrations.slack.requests.base import SlackRequest


class SlackCommandRequest(SlackRequest):

    """
    An Command request sent from Slack.

    # TODO MARCOS DESCRIBE
    """

    def __init__(self, request: Request):
        super().__init__(request)
        self._callback_data = None
