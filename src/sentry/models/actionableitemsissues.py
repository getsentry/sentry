"""
A class for tracking issues that are presented on the issue details page as Actionable Items
"""


class ActionableItemsIssues:

    REPLAY_NOT_SETUP = "replay_not_setup"
    MISSING_GIT_INTEGRATION = "missing_git_integration"

    _messages = {
        REPLAY_NOT_SETUP: "Replays are not set up",
        MISSING_GIT_INTEGRATION: "Missing git integration",
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
