import os

from sentry.nodestore.base import NodeStorage
from sentry.utils import json

dirname = os.path.dirname(__file__)
STORAGE_PATH = "nodes"


class FileSystemNodeStorage(NodeStorage):
    """
    A filesystem-backed backend for storing node data.
    """

    def _get_bytes(self, id):
        path = os.path.join(dirname, STORAGE_PATH, f"{id}.json")
        print("GET", path)

        with open(path, "rb") as file:
            data = file.read()

        return data

    def _set_bytes(self, id, data, ttl=0):
        path = os.path.join(dirname, STORAGE_PATH, f"{id}.json")
        print("SET", path)

        with open(path, "wb") as file:
            file.write(data)
