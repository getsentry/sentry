import pytest
from django.db.models import F

from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.replays.lib.cache import AutoCache, BoundedLRUCache
from sentry.replays.usecases.ingest import DropEvent
from sentry.replays.usecases.ingest.cache import _option_lookup, has_sent_replays_cache
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_has_sent_replays_cache(default_project: Project) -> None:
    default_project.update(flags=F("flags").bitor(Project.flags.has_replays))
    assert has_sent_replays_cache[default_project.id] is True


@django_db_all
def test_has_sent_replays_cache_missing_or_false(default_project: Project) -> None:
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


@django_db_all
def test_options_cache(default_project: Project) -> None:
    options_cache = AutoCache(_option_lookup, BoundedLRUCache(maxlen=10_000))

    ProjectOption.objects.set_value(
        project=default_project, key="sentry:replay_hydration_error_issues", value=True
    )
    ProjectOption.objects.set_value(
        project=default_project, key="sentry:replay_rage_click_issues", value=True
    )

    assert options_cache[default_project.id][0] is True
    assert options_cache[default_project.id][1] is True


@django_db_all
def test_options_cache_hydration(default_project: Project) -> None:
    options_cache = AutoCache(_option_lookup, BoundedLRUCache(maxlen=10_000))

    ProjectOption.objects.set_value(
        project=default_project, key="sentry:replay_hydration_error_issues", value=True
    )

    assert options_cache[default_project.id][0] is True
    assert options_cache[default_project.id][1] is False


@django_db_all
def test_options_cache_rage(default_project: Project) -> None:
    options_cache = AutoCache(_option_lookup, BoundedLRUCache(maxlen=10_000))

    ProjectOption.objects.set_value(
        project=default_project, key="sentry:replay_rage_click_issues", value=True
    )

    assert options_cache[default_project.id][0] is False
    assert options_cache[default_project.id][1] is True


@django_db_all
def test_options_cache_missing(default_project: Project) -> None:
    options_cache = AutoCache(_option_lookup, BoundedLRUCache(maxlen=10_000))

    assert options_cache[default_project.id][0] is False
    assert options_cache[default_project.id][1] is False

    assert options_cache[2346326722][0] is False
    assert options_cache[2346326722][1] is False
