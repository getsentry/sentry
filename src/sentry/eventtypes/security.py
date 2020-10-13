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


# Note on title of these events.  For whatever reason all these event types
# do not compute a title themselves.  Instead what happens it that they share
# the behavior with the default event which extracts the default title from the
# log message.  This means the `compute_title` function never computes a title.
# Instead the title is directly placed within the metadata int he default
# `extract_metadata` if a title is not otherwise placed there already.


class CspEvent(DefaultEvent):
    key = "csp"

    def extract_metadata(self, data):
        metadata = DefaultEvent.extract_metadata(self, data)
        metadata["uri"] = _normalize_uri(data["csp"].get("blocked_uri") or "")
        metadata["directive"] = data["csp"].get("effective_directive")
        return metadata

    def get_location(self, metadata):
        return metadata.get("uri")


class HpkpEvent(DefaultEvent):
    key = "hpkp"

    def extract_metadata(self, data):
        metadata = DefaultEvent.extract_metadata(self, data)
        metadata["origin"] = data["hpkp"].get("hostname")
        return metadata

    def get_location(self, metadata):
        return metadata.get("origin")


class ExpectCTEvent(DefaultEvent):
    key = "expectct"

    def extract_metadata(self, data):
        metadata = DefaultEvent.extract_metadata(self, data)
        metadata["origin"] = data["expectct"].get("hostname")
        return metadata

    def get_location(self, metadata):
        return metadata.get("origin")


class ExpectStapleEvent(DefaultEvent):
    key = "expectstaple"

    def extract_metadata(self, data):
        metadata = DefaultEvent.extract_metadata(self, data)
        metadata["origin"] = data["expectstaple"].get("hostname")
        return metadata

    def get_location(self, metadata):
        return metadata.get("origin")
