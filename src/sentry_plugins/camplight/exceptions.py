# -*- coding: utf-8 -*-

"""
camplight.exceptions
~~~~~~~~~~~~~~~~~~~~

This module contains the exceptions raised by Camplight.

"""

from requests.exceptions import *


class CamplightException(RuntimeError):
    """Base class for Camplight exceptions."""


class RoomNotFoundError(CamplightException):
    """Campfire room does not exist."""
