import logging
from urllib.parse import parse_qs

from sentry.integrations.slack.requests.base import SlackRequest, SlackRequestError

logger = logging.getLogger("sentry.integrations.slack")


class SlackCommandRequest(SlackRequest):
    """
    A Command request sent from Slack.

    Slack sends the command payload as `application/x-www-form-urlencoded`
    instead of JSON. This is slightly annoying because the values in the key-
    value pairs are all automatically wrapped in arrays.
    """

    def _validate_data(self) -> None:
        try:
            qs_data = parse_qs(self.request.body.decode("utf-8"), strict_parsing=True)
        except ValueError:
            logger.info("slack.webhook.invalid-payload", extra={"todo": "marcos"})
            raise SlackRequestError(status=400)

        # Flatten the values.
        self._data = {key: value_array[0] for key, value_array in qs_data.items()}
