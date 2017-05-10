from __future__ import absolute_import

import pytest
from celery.beat import ScheduleEntry
from sentry.celery import SentryCelery
from django.conf import settings


@pytest.mark.parametrize('name,entry', settings.CELERYBEAT_SCHEDULE.items())
def test_validate_celerybeat_schedule(name, entry):
    app = SentryCelery('sentry')
    app.config_from_object(settings)
    app.autodiscover_tasks(lambda: settings.INSTALLED_APPS)
    app.loader.import_default_modules()
    entry = ScheduleEntry(name=name, app=app, **entry)
    assert entry.task in app.tasks
