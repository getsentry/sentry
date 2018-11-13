from __future__ import absolute_import

from django.conf import settings
from sentry.utils.imports import import_string


def test_paths():
    for interface in settings.SENTRY_INTERFACES.values():
        cls = import_string(interface)
        assert cls.path == object.__new__(cls).get_path()
        assert cls.path == object.__new__(cls).get_alias()
