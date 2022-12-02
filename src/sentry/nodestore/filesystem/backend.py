import os
from typing import Optional

from sentry.nodestore.base import NodeStorage

dirname = os.path.dirname(__file__)
STORAGE_PATH = "nodes"


class FileSystemNodeStorage(NodeStorage):
    """
    A simple backend that saves each node as a file. Only appropriate for
    debugging and development!
    """

    def bootstrap(self):
        os.mkdir(self.path())

    def _get_bytes(self, id: str):
        with open(self.path(id), "rb") as file:
            return file.read()

    def _set_bytes(self, id: str, data: bytes, ttl=0):
        with open(self.path(id), "wb") as file:
            file.write(data)

    def delete(self, id):
        os.remove(self.path(id))

    @staticmethod
    def path(id: Optional[str] = None):
        if id:
            return os.path.join(dirname, STORAGE_PATH, f"{id}.json")
        else:

            return os.path.join(dirname, STORAGE_PATH)
