from __future__ import absolute_import

from jsonschema import Draft4Validator
from requests.exceptions import RequestException

from sentry.utils.sentryappwebhookrequests import SentryAppWebhookRequestsBuffer
from sentry.http import safe_urlopen


SELECT_OPTIONS_SCHEMA = {
    "type": "array",
    "definitions": {
        "select-option": {
            "type": "object",
            "properties": {"label": {"type": "string"}, "value": {"type": "string"}},
            "required": ["label", "value"],
        }
    },
    "properties": {"type": "array", "items": {"$ref": "#definitions/select-option"}},
}

ISSUE_LINKER_SCHEMA = {
    "type": "object",
    "properties": {
        "webUrl": {"type": "string"},
        "identifier": {"type": "string"},
        "project": {"type": "string"},
    },
    "required": ["webUrl", "identifier", "project"],
}

SCHEMA_LIST = {"select": SELECT_OPTIONS_SCHEMA, "issue_link": ISSUE_LINKER_SCHEMA}


def validate(instance, schema_type):
    schema = SCHEMA_LIST[schema_type]
    v = Draft4Validator(schema)

    if not v.is_valid(instance):
        return False

    return True


def send_and_save_sentry_app_request(url, sentry_app, org_id, event, **kwargs):
    """
    Send a webhook request, and save the request into the Redis buffer for the app dashboard request log
    Returns the response of the request

    kwargs ends up being the arguments passed into safe_urlopen
    """

    buffer = SentryAppWebhookRequestsBuffer(sentry_app)

    try:
        resp = safe_urlopen(url=url, **kwargs)
    except RequestException:
        # Response code of 0 represents timeout
        buffer.add_request(response_code=0, org_id=org_id, event=event, url=url)
        # Re-raise the exception because some of these tasks might retry on the exception
        raise

    buffer.add_request(
        response_code=resp.status_code,
        org_id=org_id,
        event=event,
        url=url,
        error_id=resp.headers.get("Sentry-Hook-Error"),
        project_id=resp.headers.get("Sentry-Hook-Project"),
    )

    return resp
