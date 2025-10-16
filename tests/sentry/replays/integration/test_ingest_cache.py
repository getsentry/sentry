import pytest
from django.db.models import F

from sentry.models.project import Project
from sentry.replays.usecases.ingest import DropEvent
from sentry.replays.usecases.ingest.cache import has_sent_replays_cache
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_has_sent_replays_cache(default_project):
    default_project.update(flags=F("flags").bitor(Project.flags.has_replays))
    assert has_sent_replays_cache[default_project.id] is True


@django_db_all
def test_has_sent_replays_cache_missing_or_false(default_project):
    assert has_sent_replays_cache[default_project.id] is False

    # False value is still cached. This is expected behavior. In the implementation we'll
    # overwrite the false value with a true value.
    default_project.update(flags=F("flags").bitor(Project.flags.has_replays))
    assert has_sent_replays_cache[default_project.id] is False

    # Manual overwrites removes the false value and true can now be read.
    has_sent_replays_cache[default_project.id] = True
    assert has_sent_replays_cache[default_project.id] is True

    # Missing or invalid projects raise.
    with pytest.raises(DropEvent):
        has_sent_replays_cache[35165136121]
