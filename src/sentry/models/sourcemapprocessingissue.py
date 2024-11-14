"""
A class for tracking specific source map errors, based on EventError
"""


class SourceMapProcessingIssue:
    # Generic errors
    UNKNOWN_ERROR = "unknown_error"
    MISSING_RELEASE = "no_release_on_event"
    MISSING_SOURCEMAPS = "no_sourcemaps_on_release"
    URL_NOT_VALID = "url_not_valid"
    NO_URL_MATCH = "no_url_match"
    PARTIAL_MATCH = "partial_match"
    DIST_MISMATCH = "dist_mismatch"
    SOURCEMAP_NOT_FOUND = "sourcemap_not_found"
    DEBUG_ID_NO_SOURCEMAPS = "debug_id_no_sourcemaps"

    _messages = {
        UNKNOWN_ERROR: "Unknown error",
        MISSING_RELEASE: "The event is missing a release",
        MISSING_SOURCEMAPS: "The release is missing source maps",
        URL_NOT_VALID: "The absolute path url is not valid",
        NO_URL_MATCH: "The absolute path url does not match any source maps",
        PARTIAL_MATCH: "The absolute path url is a partial match",
        DIST_MISMATCH: "The dist values do not match",
        SOURCEMAP_NOT_FOUND: "The sourcemap could not be found",
        DEBUG_ID_NO_SOURCEMAPS: "Can use debug id but no sourcemaps",
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
