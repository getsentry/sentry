import os

from sentry.nodestore.base import NodeStorage

dirname = os.path.dirname(__file__)
STORAGE_PATH = "nodes"


class FileSystemNodeStorage(NodeStorage):
    """
    A simple backend that saves each node as a file. Only appropriate for
    debugging and development!
    """

    def _get_bytes(self, id):
        with open(self.path(id), "rb") as file:
            return file.read()

    def _set_bytes(self, id, data, ttl=0):
        with open(self.path(id), "wb") as file:
            file.write(data)

    def delete(self, id):
        os.remove(self.path(id))

    @staticmethod
    def path(id):
        return os.path.join(dirname, STORAGE_PATH, f"{id}.json")
