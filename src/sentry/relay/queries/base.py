from __future__ import absolute_import


class InvalidQuery(Exception):
    pass


class BaseQuery(object):

    def __init__(self, relay):
        self.relay = relay

    def preprocess(self, query):
        pass

    def execute(self):
        pass
