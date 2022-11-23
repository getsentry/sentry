import os

from sentry.nodestore.base import NodeStorage

dirname = os.path.dirname(__file__)
STORAGE_PATH = "nodes"


class FileSystemNodeStorage(NodeStorage):
    def _get_bytes(self, id):
        with open(FileSystemNodeStorage.path(id), "rb") as file:
            return file.read()

    def _set_bytes(self, id, data, ttl=0):
        with open(FileSystemNodeStorage.path(id), "wb") as file:
            file.write(data)

    def delete(self, id):
        os.remove(FileSystemNodeStorage.path(id))

    @staticmethod
    def path(id):
        return os.path.join(dirname, STORAGE_PATH, f"{id}.json")
