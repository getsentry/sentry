from typing import Any

from google.auth.credentials import Credentials
from google.cloud.storage.bucket import Bucket

class Client:
    _http: Any
    project: str | None
    def __init__(
        self,
        project: str | None = None,
        credentials: Credentials | None = None,
        **kwargs: Any,
    ) -> None: ...
    def bucket(self, bucket_name: str, user_project: str | None = None) -> Bucket: ...
