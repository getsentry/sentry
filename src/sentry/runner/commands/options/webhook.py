import requests
from django.conf import settings

from sentry.utils import json


def send_to_webhook(json_data: dict) -> None:
    """
    Helper function for sending runtime option changes to the webhook.
    """
    if settings.OPTIONS_AUTOMATOR_SLACK_WEBHOOK_URL:
        headers = {"Content-Type": "application/json"}
        requests.post(
            settings.OPTIONS_AUTOMATOR_SLACK_WEBHOOK_URL,
            data=json.dumps(json_data),
            headers=headers,
        ).raise_for_status()
