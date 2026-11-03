from typing import Any

class SlackClientError(Exception): ...

class SlackApiError(SlackClientError):
    response: Any
    def __init__(self, message: str, response: Any) -> None: ...
