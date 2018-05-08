from __future__ import absolute_import

from rest_framework import status


class InvalidQuery(Exception):
    # TODO(hazat): dunno about this attrs
    message = 'Unsupported query type'
    code = 1001
    response = {'error': message, 'code': code}
    status_code = status.HTTP_400_BAD_REQUEST


class BaseQuery(object):

    def __init__(self, relay):
        self.relay = relay

    def preprocess(self, query):
        pass
