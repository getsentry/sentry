from __future__ import absolute_import

import logging
import six

from sentry.api.client import ApiError
from sentry.integrations.metric_alerts import incident_attachment_info
from sentry.integrations.slack.client import SlackClient
from sentry.utils import json
from sentry.utils.dates import to_timestamp


logger = logging.getLogger("sentry.integrations.slack")
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

    client = SlackClient()
    try:
        client.post("/chat.postMessage", data=payload, timeout=5)
    except ApiError as e:
        logger.info("rule.fail.slack_post", extra={"error": six.text_type(e)})


def build_group_attachment(group, event=None, tags=None, identity=None, actions=None, rules=None):
    pass


def build_user_choice(user_response, user_id_field):
    """
    Build an (id, label) tuple from the given Jira REST API User resource,
    or return None if a tuple could not be built.
    """
    if user_id_field not in user_response:
        return None

    # The name field can be blank in jira-cloud, and the id_field varies by
    # jira-cloud and jira-server
    name = user_response.get("name", "")
    email = user_response.get("emailAddress")

    display = "%s %s%s" % (
        user_response.get("displayName", name),
        "- %s " % email if email else "",
        "(%s)" % name if name else "",
    )
    return user_response[user_id_field], display.strip()


def transform_jira_fields_to_form_fields(fields_list):
    """
    The fields array from Jira doesn't exactly match the Alert Rules front
    end's expected format. Massage the field names and types and put them in a dict.

    :param fields_list: Create ticket fields from Jira as an array.
    :return: The "create ticket" fields from Jira as a dict.
    """
    return {
        field["name"]: {
            key: ({"select": "choice", "text": "string"}.get(value, value))
            if key == "type"
            else value
            for key, value in field.items()
            if key != "updatesForm"
        }
        for field in fields_list
        if field["name"]
    }


def transform_jira_choices_to_strings(fields, data):
    return {
        key: ({k: v for k, v in fields[key]["choices"]}.get(value, value))
        if key in fields and fields[key]["type"] == "choice"
        else value
        for key, value in data.items()
    }


def get_integration_type(integration):
    metadata = integration.metadata
    # classic bots had a user_access_token in the metadata
    default_installation = "classic_bot" if "user_access_token" in metadata else "workspace_app"
    return metadata.get("installation_type", default_installation)


def get_issue_type_meta(issue_type, meta):
    """
    Get the issue_type metadata in the Jira metadata object if it exists,
    otherwise return whichever is first in the list.

    :param issue_type: The issue type as a string. E.g. "Story"
    :param meta: A Jira metadata object for creating tickets
    :return: The issue_type metadata object
    """
    issue_types = meta["issuetypes"]
    issue_type_meta = None
    if issue_type:
        matching_type = [t for t in issue_types if t["id"] == issue_type]
        issue_type_meta = matching_type[0] if len(matching_type) > 0 else None

    # still no issue type? just use the first one.
    if not issue_type_meta:
        issue_type_meta = issue_types[0]

    return issue_type_meta
