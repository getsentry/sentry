from django.conf import settings


def test_import_paths():
    for path in settings.CELERY_IMPORTS:
        try:
            __import__(path)
        except ImportError:
            raise AssertionError(f"Unable to import {path} from CELERY_IMPORTS")
