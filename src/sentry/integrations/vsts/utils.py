import logging
import six

from sentry.api.client import ApiError
from sentry.integrations.metric_alerts import incident_attachment_info
from sentry.integrations.vsts.client import VstsApiClient
from sentry.utils import json
from sentry.utils.dates import to_timestamp


logger = logging.getLogger("sentry.integrations.azure_devops")
# TODO MARCOS this is all metric alerts, what about issue alerts?


def build_incident_attachment(incident, metric_value=None):
    data = incident_attachment_info(incident, metric_value)
    return {
        "fallback": data["title"],
        "title": data["title"],
        "title_link": data["title_link"],
        "text": data["text"],
        "fields": [],
        "mrkdwn_in": ["text"],
        "footer_icon": data["logo_url"],
        "footer": "Sentry Incident",
        "ts": to_timestamp(data["ts"]),
        "actions": [],
    }


def send_incident_alert_notification(action, incident, metric_value):
    channel = action.target_identifier
    integration = action.integration
    attachment = build_incident_attachment(incident, metric_value)
    payload = {
        "token": integration.metadata["access_token"],
        "channel": channel,
        "attachments": json.dumps([attachment]),
    }

    client = VstsApiClient()
    try:
        client.post("/chat.postMessage", data=payload, timeout=5)
    except ApiError as e:
        logger.info("rule.fail.azure_devops_post", extra={"error": six.text_type(e)})


def build_group_attachment(group, event=None, tags=None, identity=None, actions=None, rules=None):
    pass


def get_integration_type(integration):
    metadata = integration.metadata
    # classic bots had a user_access_token in the metadata
    default_installation = "classic_bot" if "user_access_token" in metadata else "workspace_app"
    return metadata.get("installation_type", default_installation)
