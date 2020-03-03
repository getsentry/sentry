from __future__ import absolute_import

from enum import Enum


class AssistantManager(object):
    def __init__(self):
        self._guides = []

    def add(self, guide):
        if isinstance(guide, Enum):
            self._guides.append(guide)

    def get_id_by_name(self, name):
        for guide in self._guides:
            if name == guide.name.lower():
                return guide.value

    def all(self):
        return self._guides
