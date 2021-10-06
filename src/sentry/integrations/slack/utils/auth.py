import hmac
import time
from datetime import datetime
from hashlib import sha256
from typing import Mapping


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
    return hmac.compare_digest(request_hash.encode("utf-8"), signature.encode("utf-8"))
