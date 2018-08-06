from __future__ import absolute_import


class ChangesetError(Exception):
    pass


class BaseChangeset(object):

    def __init__(self, relay):
        self.relay = relay

    def preprocess(self, query):
        pass

    def execute(self):
        pass
