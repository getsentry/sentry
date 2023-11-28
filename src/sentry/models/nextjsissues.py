"""
A class for tracking NextJS Issues
"""


class NextJSIssues:
    # Generic errors
    HANDLE_HARD_NAVIGATION = "handle_hard_navigation"

    _messages = {
        HANDLE_HARD_NAVIGATION: "handled hard navigation",
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
