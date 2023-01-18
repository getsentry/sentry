"""
A class for tracking specific source map errors, based on EventError
"""


class SourceMapProcessingIssue:
    # Generic errors
    UNKNOWN_ERROR = "unknown_error"
    MISSING_RELEASE = "no_release_on_event"

    _messages = {
        UNKNOWN_ERROR: "Unknown error",
        MISSING_RELEASE: "The event is missing a release",
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
