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

    def __init__(self, prefix_path=None):
        self.prefix_path: str = "nodestore/"
        if not settings.DEBUG and options_store.get("filestore.backend") == "filesystem":
            raise ValueError("Local fileSystem should only be used in development!")
        if prefix_path:
            self.prefix_path = prefix_path

    def _get_bytes(self, id: str):
        storage = get_storage()
        path = self.node_path(id)
        return storage.open(path).read()

    def _set_bytes(self, id: str, data: bytes, ttl=0):
        storage = get_storage()
        path = self.node_path(id)
        storage.save(path, BytesIO(data))

    def delete(self, id):
        storage = get_storage()
        path = self.node_path(id)
        storage.delete(path)

    def cleanup(self, cutoff: datetime.datetime):
        """
        This driver does not have managed TTLs.  To enable TTLs you will need to enable it on your
        bucket.
        """
        raise NotImplementedError

    def bootstrap(self):
        # Nothing for filesystem backend to do during bootstrap
        pass

    def node_path(self, id: str):
        return f"{self.prefix_path}{id}.json"
