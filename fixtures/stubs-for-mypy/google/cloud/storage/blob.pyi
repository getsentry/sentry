from datetime import datetime
from typing import IO, Any

from google.cloud.storage.bucket import Bucket

class Blob:
    name: str
    size: int | None
    updated: datetime
    public_url: str
    path: str
    generation: int | None
    content_type: str | None
    def __init__(self, name: str, bucket: Bucket, **kwargs: Any) -> None: ...
    def reload(self, client: Any = None, timeout: float = ...) -> None: ...
    def upload_from_file(
        self,
        file_obj: IO[bytes],
        size: int | None = None,
        content_type: str | None = None,
        **kwargs: Any,
    ) -> None: ...
    def upload_from_string(
        self, data: bytes | str, content_type: str | None = None, **kwargs: Any
    ) -> None: ...
    def download_to_file(self, file_obj: IO[bytes], **kwargs: Any) -> None: ...
    def download_as_bytes(self, **kwargs: Any) -> bytes: ...
    def exists(self, client: Any = None) -> bool: ...
    def delete(self, client: Any = None) -> None: ...
