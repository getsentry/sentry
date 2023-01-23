"""
A class for tracking specific source map errors, based on EventError
"""


class SourceMapProcessingIssue:
    # Generic errors
    UNKNOWN_ERROR = "unknown_error"
    MISSING_RELEASE = "no_release_on_event"
    MISSING_USER_AGENT = "no_user_agent_on_release"
    MISSING_SOURCEMAPS = "no_sourcemaps_on_release"
    URL_NOT_VALID = "url_not_valid"

    _messages = {
        UNKNOWN_ERROR: "Unknown error",
        MISSING_RELEASE: "The event is missing a release",
        MISSING_USER_AGENT: "The release is missing a user agent",
        MISSING_SOURCEMAPS: "The release is missing source maps",
        URL_NOT_VALID: "The absolute path url is not valid",
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
