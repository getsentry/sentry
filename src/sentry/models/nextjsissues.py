"""
A class for tracking NextJS Issues
"""


class NextJSIssues:
    # Generic errors
    HANDLE_HARD_NAVIGATION = "handle_hard_navigation"
    HYDRATION_ERROR = "hydration_error"
    CHUNK_LOAD_ERROR = "chunk_load_error"
    STATIC_GENERATION_BAILOUT = "static_generation_bailout"

    _messages = {
        HANDLE_HARD_NAVIGATION: "handled hard navigation",
        HYDRATION_ERROR: "hydration mismatch",
        CHUNK_LOAD_ERROR: "chunk load error",
        STATIC_GENERATION_BAILOUT: "static generation bailout",
    }

    @classmethod
    def get_message(cls, data):
        return cls(data).message

    def __init__(self, type, data=None):
        self.type = type
        self.data = data

    @property
    def message(self):
        return self._messages.get(self.type, "unknown")

    def get_api_context(self):
        return {"type": self.type, "message": self.message, "data": self.data}
