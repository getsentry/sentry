from __future__ import absolute_import

import pytest
from celery.beat import ScheduleEntry
from sentry.celery import app
from django.conf import settings

app.loader.import_default_modules()


@pytest.mark.parametrize('name,entry', settings.CELERYBEAT_SCHEDULE.items())
def test_validate_celerybeat_schedule(name, entry):
    entry = ScheduleEntry(name=name, app=app, **entry)
    assert entry.task in app.tasks
