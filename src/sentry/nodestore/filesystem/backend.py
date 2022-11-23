import logging

from sentry.nodestore.base import NodeStorage

logger = logging.getLogger("sentry")


class FileSystemNodeStorage(NodeStorage):
    """
    A filesystem-backed backend for storing node data.
    """

    pass
