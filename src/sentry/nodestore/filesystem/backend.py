import datetime
from io import BytesIO

from django.conf import settings

from sentry import options as options_store
from sentry.models.file import get_storage
from sentry.nodestore.base import NodeStorage


class FileSystemNodeStorage(NodeStorage):
    """
    A file system-based backend that saves each node as a file, Local fileSystem only appropriate for
    debugging and development! For production environments, please use S3 or GCS. config.yml Configuration reference:
    >>> filestore.backend: "s3"
    ... filestore.options:
    ...   access_key: "xxx"
    ...   secret_key: "xxx"
    ...   endpoint_url: "https://s3.us-east-1.amazonaws.com"
    ...   bucket_name: "sentry"
    ...   location: "/sentry"
    """

    def __init__(self, path: str | None = None):
        self.path: str = ""

        if not settings.DEBUG:
            raise ValueError("FileSystemNodeStorage should only be used in development!")
        if path:
            self.path = os.path.abspath(os.path.expanduser(path))
        else:
            self.path = os.path.abspath(os.path.join(os.path.dirname(__file__), "./nodes"))

    def _get_bytes(self, id: str) -> bytes:
        with open(self.node_path(id), "rb") as file:
            return file.read()

    def _set_bytes(self, id: str, data: bytes, ttl: timedelta | None = None) -> None:
        with open(self.node_path(id), "wb") as file:
            file.write(data)

    def delete(self, id: str) -> None:
        os.remove(self.node_path(id))

    def cleanup(self, cutoff: datetime) -> None:
        for filename in os.listdir(self.path):
            path = os.path.join(self.path, filename)
            creation_datetime = datetime.fromtimestamp(os.path.getctime(path)).replace(
                tzinfo=timezone.utc
            )

            if creation_datetime > cutoff:
                os.remove(path)

    def bootstrap(self) -> None:
        try:
            os.mkdir(self.path)
        except FileExistsError:
            pass

    def node_path(self, id: str) -> str:
        return os.path.join(self.path, f"{id}.json")
      