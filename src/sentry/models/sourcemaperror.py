"""
A class for tracking specific source map errors, based on EventError
"""


class SourceMapError:
    # Generic errors
    UNKNOWN_ERROR = "unknown_error"
    NO_RELEASE_ON_EVENT = "no_release_on_event"

    _messages = {
        UNKNOWN_ERROR: "Unknown error",
        NO_RELEASE_ON_EVENT: "The event is not tagged with a release",
    }

    @classmethod
    def get_message(cls, data):
        return cls(data).message

    def __init__(self, type, data=None):
        self.type = type
        self.data = data

    @property
    def message(self):
        return self._messages.get(self.type, self._messages["unknown_error"])

    def get_api_context(self):
        return {"type": self.type, "message": self.message, "data": self.data}
