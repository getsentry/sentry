from __future__ import absolute_import

from sentry.plugins import register

from .plugin import NativePlugin

register(NativePlugin)
