from __future__ import absolute_import

from warnings import warn

from sentry.utils.strings import truncatechars, strip
from sentry.utils.safe import get_path

# Note: Detecting eventtypes is implemented in the Relay Rust library.


class BaseEvent(object):
    id = None

    def get_metadata(self, data):
        raise NotImplementedError

    def get_title(self, metadata):
        raise NotImplementedError

    def get_location(self, metadata):
        return None

    def to_string(self, metadata):
        warn(DeprecationWarning("This method was replaced by get_title", stacklevel=2))
        return self.get_title()


class DefaultEvent(BaseEvent):
    key = "default"

    def get_metadata(self, data):
        message = strip(
            get_path(data, "logentry", "formatted") or get_path(data, "logentry", "message")
        )

        if message:
            title = truncatechars(message.splitlines()[0], 100)
        else:
            title = "<unlabeled event>"

        return {"title": title}

    def get_title(self, metadata):
        return metadata.get("title") or "<untitled>"
