import datetime
import os
from datetime import timezone

from django.conf import settings

from sentry.nodestore.base import NodeStorage


class FileSystemNodeStorage(NodeStorage):
    """
    A simple backend that saves each node as a file. Only appropriate for
    debugging and development!
    """

    def __init__(self, path=None):
        self.path: str = ""

        if not settings.DEBUG:
            raise ValueError("FileSystemNodeStorage should only be used in development!")
        if path:
            self.path = os.path.abspath(os.path.expanduser(path))
        else:
            self.path = os.path.abspath(os.path.join(os.path.dirname(__file__), "./nodes"))

    def _get_bytes(self, id: str):
        with open(self.node_path(id), "rb") as file:
            return file.read()

    def _set_bytes(self, id: str, data: bytes, ttl=0):
        with open(self.node_path(id), "wb") as file:
            file.write(data)

    def delete(self, id):
        os.remove(self.node_path(id))

    def cleanup(self, cutoff: datetime.datetime):
        for filename in os.listdir(self.path):
            path = os.path.join(self.path, filename)
            creation_datetime = datetime.datetime.fromtimestamp(os.path.getctime(path)).replace(
                tzinfo=timezone.utc
            )

            if creation_datetime > cutoff:
                os.remove(path)

    def bootstrap(self):
        try:
            os.mkdir(self.path)
        except FileExistsError:
            pass

    def node_path(self, id: str):
        return os.path.join(self.path, f"{id}.json")
