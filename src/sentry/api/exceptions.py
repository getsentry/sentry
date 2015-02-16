from __future__ import absolute_import

from rest_framework.exceptions import APIException


class ResourceDoesNotExist(APIException):
    status_code = 404
