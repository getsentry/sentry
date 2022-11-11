import hmac
import time
from datetime import datetime
from hashlib import sha256
from typing import TYPE_CHECKING, Mapping

if TYPE_CHECKING:
    from sentry.models import OrganizationMember


ALLOWED_ROLES = ["admin", "manager", "owner"]


def is_valid_role(org_member: "OrganizationMember") -> bool:
    return org_member.role in ALLOWED_ROLES


def _encode_data(secret: str, data: bytes, timestamp: str) -> str:
    req = b"v0:%s:%s" % (timestamp.encode("utf-8"), data)
    return "v0=" + hmac.new(secret.encode("utf-8"), req, sha256).hexdigest()


def set_signing_secret(secret: str, data: bytes) -> Mapping[str, str]:
    """Note: this is currently only used in tests."""
    timestamp = str(int(time.mktime(datetime.utcnow().timetuple())))
    signature = _encode_data(secret, data, timestamp)
    return {
        "HTTP_X_SLACK_REQUEST_TIMESTAMP": timestamp,
        "HTTP_X_SLACK_SIGNATURE": signature,
    }


def check_signing_secret(signing_secret: str, data: bytes, timestamp: str, signature: str) -> bool:
    # Taken from: https://github.com/slackapi/python-slack-events-api/blob/master/slackeventsapi/server.py#L47
    # Slack docs on this here: https://api.slack.com/authentication/verifying-requests-from-slack#about
    request_hash = _encode_data(signing_secret, data, timestamp)
    is_request_valid = hmac.compare_digest(request_hash.encode("utf-8"), signature.encode("utf-8"))
    # HACK: Forwarding webhooks for Hybrid Cloud involves deserializing the request body to identify
    # the organization regions and re-serializing it to forward to silos. Though the JSON payload is
    # identical, when we serialize, we add whitespace to the byte string in the request body, so
    # verification fails against the header. Until we add a mechanism to check Slack's signature OR
    # Sentry's signature to verify the request, we hack here to remove the whitespace and re-check.
    if not is_request_valid:
        serialized_request_hash = _encode_data(signing_secret, data.replace(b" ", b""), timestamp)
        return hmac.compare_digest(
            serialized_request_hash.encode("utf-8"), signature.encode("utf-8")
        )
    return is_request_valid
