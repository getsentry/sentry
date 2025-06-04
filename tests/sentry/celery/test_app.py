import pytest
from celery.beat import ScheduleEntry
from django.conf import settings

from sentry.celery import app

app.loader.import_default_modules()


# XXX(dcramer): this doesn't actually work as we'd expect, as if the task is imported
# anywhere else before this code is run it will still show up as registered
@pytest.mark.parametrize("name,entry", list(settings.CELERYBEAT_SCHEDULE.items()))
def test_validate_celerybeat_schedule(name, entry):
    entry = ScheduleEntry(name=name, app=app, **entry)
    assert entry.task in app.tasks
    mod_name = app.tasks[entry.task].__module__
    assert mod_name in settings.CELERY_IMPORTS, f"{mod_name} is missing from CELERY_IMPORTS"
    # Test that the schedules are valid. Throws a RuntimeError if one is invalid.
    entry.is_due()
