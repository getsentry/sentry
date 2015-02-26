from __future__ import absolute_import, print_function

from sentry.plugins import register

from .plugin import JavascriptPlugin

register(JavascriptPlugin)
