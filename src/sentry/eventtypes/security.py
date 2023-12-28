from sentry.security import csp
from sentry.utils.safe import get_path
from sentry.utils.strings import strip

from .base import BaseEvent


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
        metadata["uri"] = csp.normalize_value(data["csp"].get("blocked_uri") or "")
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
