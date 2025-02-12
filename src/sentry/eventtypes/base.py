from warnings import warn

from sentry import options
from sentry.utils.safe import get_path
from sentry.utils.strings import strip, truncatechars

# Note: Detecting eventtypes is implemented in the Relay Rust library.


class BaseEvent:
    id = None

    def get_metadata(self, data):
        metadata = self.extract_metadata(data)
        title = data.get("title")
        if title is not None:
            # If we already have a custom title, it needs to be in metadata
            # regardless of what extract_metadata returns.
            metadata["title"] = title

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
        warn(DeprecationWarning("This method was replaced by get_title"), stacklevel=2)
        return self.get_title(metadata)


class DefaultEvent(BaseEvent):
    key = "default"

    def extract_metadata(self, data):
        message = strip(
            get_path(data, "logentry", "formatted") or get_path(data, "logentry", "message")
        )

        if message:
            if options.get("sentry.save-event.title-char-limit-256.enabled"):
                truncate_to = 256
            else:
                truncate_to = 100
            title = truncatechars(message.splitlines()[0], truncate_to)
        else:
            title = "<unlabeled event>"

        return {"title": title}
