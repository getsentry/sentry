from warnings import warn

from sentry.utils.safe import get_path
from sentry.utils.strings import strip, truncatechars

# Note: Detecting eventtypes is implemented in the Relay Rust library.


class BaseEvent:
    id = None

    def get_metadata(self, data):
        metadata = {}
        title = data.get("title")
        if title is not None:
            metadata["title"] = title
        for key, value in self.extract_metadata(data).items():
            # If we already have a custom title, do not override with the
            # computed title.
            if key not in metadata:
                metadata[key] = value
        return metadata

    def get_title(self, metadata):
        title = metadata.get("title")
        if title is not None:
            return title
        return self.compute_title(metadata) or "<untitled>"

    def compute_title(self, metadata):
        return None

    def extract_metadata(self, metadata):
        return {}

    def get_location(self, metadata):
        return None

    def to_string(self, metadata):
        warn(DeprecationWarning("This method was replaced by get_title", stacklevel=2))
        return self.get_title()


class DefaultEvent(BaseEvent):
    key = "default"

    def extract_metadata(self, data):
        message = strip(
            get_path(data, "logentry", "formatted") or get_path(data, "logentry", "message")
        )

        if message:
            title = truncatechars(message.splitlines()[0], 100)
        else:
            title = "<unlabeled event>"

        return {"title": title}
