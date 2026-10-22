from django.urls import reverse

from sentry.integrations.bitbucket_server.client import (
    BitbucketServerWebhookData,
    BitbucketServerWebhookResponse,
)
from sentry.utils.http import absolute_uri

WEBHOOK_NAME = "sentry-bitbucket-server-repo-hook"
WEBHOOK_EVENTS = ("repo:refs_changed", "pr:merged")


def build_webhook_data(
    *,
    organization_id: int,
    integration_id: int,
    secret: str,
    active: bool,
) -> BitbucketServerWebhookData:
    return {
        "name": WEBHOOK_NAME,
        "url": absolute_uri(
            reverse(
                "sentry-extensions-bitbucketserver-webhook",
                kwargs={
                    "organization_id": organization_id,
                    "integration_id": integration_id,
                },
            )
        ),
        "active": active,
        "events": list(WEBHOOK_EVENTS),
        "configuration": {"secret": secret},
    }


def build_webhook_update_data(
    webhook: BitbucketServerWebhookResponse, *, secret: str
) -> BitbucketServerWebhookData:
    data: BitbucketServerWebhookData = {
        "name": webhook["name"],
        "url": webhook["url"],
        "active": webhook["active"],
        "events": webhook["events"],
        "configuration": {**webhook.get("configuration", {}), "secret": secret},
    }
    if "sslVerificationRequired" in webhook:
        data["sslVerificationRequired"] = webhook["sslVerificationRequired"]
    return data
