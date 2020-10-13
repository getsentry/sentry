from __future__ import absolute_import

from six.moves.urllib.parse import urlsplit, urlunsplit

from .base import DefaultEvent

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


class CspEvent(DefaultEvent):
    key = "csp"

    def get_metadata(self, data):
        metadata = DefaultEvent.get_metadata(self, data)
        metadata["uri"] = _normalize_uri(data["csp"].get("blocked_uri") or "")
        metadata["directive"] = data["csp"].get("effective_directive")
        return metadata

    def get_location(self, metadata):
        return metadata.get("uri")


class HpkpEvent(DefaultEvent):
    key = "hpkp"

    def get_metadata(self, data):
        metadata = DefaultEvent.get_metadata(self, data)
        metadata["origin"] = data["hpkp"].get("hostname")
        return metadata

    def get_location(self, metadata):
        return metadata.get("origin")


class ExpectCTEvent(DefaultEvent):
    key = "expectct"

    def get_metadata(self, data):
        metadata = DefaultEvent.get_metadata(self, data)
        metadata["origin"] = data["expectct"].get("hostname")
        return metadata

    def get_location(self, metadata):
        return metadata.get("origin")


class ExpectStapleEvent(DefaultEvent):
    key = "expectstaple"

    def get_metadata(self, data):
        metadata = DefaultEvent.get_metadata(self, data)
        metadata["origin"] = data["expectstaple"].get("hostname")
        return metadata

    def get_location(self, metadata):
        return metadata.get("origin")
