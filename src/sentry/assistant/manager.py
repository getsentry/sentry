from __future__ import absolute_import
import six


class AssistantManager(object):
    def __init__(self):
        self._id_registry = {}
        self._ids = set()

    def add(self, GUIDES):
        for k, v in six.iteritems(GUIDES):
            self._id_registry[k] = v
            self._ids.add(v['id'])

    def all(self):
        return self._id_registry

    def get_valid_ids(self):
        return self._ids
