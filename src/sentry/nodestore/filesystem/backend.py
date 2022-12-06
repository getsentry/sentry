import os

from sentry.nodestore.base import NodeStorage


class FileSystemNodeStorage(NodeStorage):
    """
    A simple backend that saves each node as a file. Only appropriate for
    debugging and development!
    """

    def __init__(self, path=None):
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

    def bootstrap(self):
        try:
            os.mkdir(self.path)
        except FileExistsError:
            pass

    def node_path(self, id: str):
        return os.path.join(self.path, f"{id}.json")
