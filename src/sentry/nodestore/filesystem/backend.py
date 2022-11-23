import os

from sentry.nodestore.base import NodeStorage
from sentry.utils import json

dirname = os.path.dirname(__file__)
STORAGE_PATH = "nodes"


class FileSystemNodeStorage(NodeStorage):
    """
    A filesystem-backed backend for storing node data.
    """

    def get(self, id):
        path = os.path.join(dirname, STORAGE_PATH, f"{id}.json")
        print("GET", path)
        with open(path) as file:
            data = json.loads(file.read())

        return data

    def _set(self, id, data):
        path = os.path.join(dirname, STORAGE_PATH, f"{id}.json")
        print("SET", path)

        with open(path, "w") as file:
            file.write(json.dumps(data))

    def delete(self, id):
        path = os.path.join(dirname, STORAGE_PATH, f"{id}.json")
        print("DELETE", path)
        os.remove(path)

    save = _set
    set = _set
    set_subkeys = _set
