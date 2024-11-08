import hmac
import time
from datetime import datetime
from hashlib import sha256
from typing import TYPE_CHECKING, TypedDict

if TYPE_CHECKING:
    from sentry.models.organizationmember import OrganizationMember


ALLOWED_ROLES = ["admin", "manager", "owner"]


def is_valid_role(org_member: "OrganizationMember") -> bool:
    return len({org_member.role} & set(ALLOWED_ROLES)) > 0


def _encode_data(secret: str, data: bytes, timestamp: str) -> str:
    req = b"v0:%s:%s" % (timestamp.encode("utf-8"), data)
    return "v0=" + hmac.new(secret.encode("utf-8"), req, sha256).hexdigest()


class SigningSecretKwargs(TypedDict):
    HTTP_X_SLACK_REQUEST_TIMESTAMP: str
    HTTP_X_SLACK_SIGNATURE: str


def set_signing_secret(secret: str, data: bytes) -> SigningSecretKwargs:
    """Note: this is currently only used in tests."""
    timestamp = str(int(time.mktime(datetime.utcnow().timetuple())))
    signature = _encode_data(secret, data, timestamp)
    return {
        "HTTP_X_SLACK_REQUEST_TIMESTAMP": timestamp,
        "HTTP_X_SLACK_SIGNATURE": signature,
    }
