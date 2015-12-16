from __future__ import absolute_import

from django.conf import settings


def test_import_paths():
    for path in settings.CELERY_IMPORTS:
        try:
            __import__(path)
        except ImportError:
            raise AssertionError('Unable to import {} from CELERY_IMPORTS'.format(path))
