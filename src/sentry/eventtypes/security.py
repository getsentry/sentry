from urllib.parse import urlsplit, urlunsplit

from sentry.utils.safe import get_path
from sentry.utils.strings import strip

from .base import BaseEvent

LOCAL = "'self'"


def _normalize_uri(value):
    if value in ("", LOCAL, LOCAL.strip("'")):
        return LOCAL

    # A lot of these values get reported as literally
    # just the scheme. So a value like 'data' or 'blob', which
    # are valid schemes, just not a uri. So we want to
    # normalize it into a uri.
    if ":" not in value:
        scheme, hostname = value, ""
    else:
        scheme, hostname = urlsplit(value)[:2]
        if scheme in ("http", "https"):
            return hostname
    return urlunsplit((scheme, hostname, "", None, None))


class SecurityEvent(BaseEvent):
    def extract_metadata(self, data):
        # Relay normalizes the message for security reports into the log entry
        # field, so we grab the message from there.
        # (https://github.com/getsentry/relay/pull/558)
        message = strip(
            get_path(data, "logentry", "formatted") or get_path(data, "logentry", "message")
        )
        return {"message": message}

    def get_title(self, metadata):
        # Due to a regression (https://github.com/getsentry/sentry/pull/19794)
        # some events did not have message persisted but title. Because of this
        # the title code has to take these into account.
        return metadata.get("message") or metadata.get("title") or "<untitled>"

    def get_location(self, metadata):
        # Try to get location by preferring URI over origin.  This covers
        # all the cases below where CSP sets URI and others set origin.
        return metadata.get("uri") or metadata.get("origin")


class CspEvent(SecurityEvent):
    key = "csp"

    def extract_metadata(self, data):
        metadata = SecurityEvent.extract_metadata(self, data)
        metadata["uri"] = _normalize_uri(data["csp"].get("blocked_uri") or "")
        metadata["directive"] = data["csp"].get("effective_directive")
        return metadata


class HpkpEvent(SecurityEvent):
    key = "hpkp"

    def extract_metadata(self, data):
        metadata = SecurityEvent.extract_metadata(self, data)
        metadata["origin"] = data["hpkp"].get("hostname")
        return metadata


class ExpectCTEvent(SecurityEvent):
    key = "expectct"

    def extract_metadata(self, data):
        metadata = SecurityEvent.extract_metadata(self, data)
        metadata["origin"] = data["expectct"].get("hostname")
        return metadata


class ExpectStapleEvent(SecurityEvent):
    key = "expectstaple"

    def extract_metadata(self, data):
        metadata = SecurityEvent.extract_metadata(self, data)
        metadata["origin"] = data["expectstaple"].get("hostname")
        return metadata
