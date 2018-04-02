from __future__ import absolute_import

from rest_framework.exceptions import APIException


class ResourceDoesNotExist(APIException):
    status_code = 404


class ResourceMoved(APIException):
    status_code = 301


class InvalidRepository(Exception):
    pass
