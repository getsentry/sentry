from typing import Any

from google.auth.credentials import Credentials

class Client:
    _http: Any
    project: str | None
    def __init__(
        self,
        project: str | None = None,
        credentials: Credentials | None = None,
        **kwargs: Any,
    ) -> None: ...
