from typing import int
import pytest
from django.db.models import F

from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.replays.usecases.ingest import DropEvent
from sentry.replays.usecases.ingest.cache import make_has_sent_replays_cache, make_options_cache
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_has_sent_replays_cache(default_project: Project) -> None:
    cache = make_has_sent_replays_cache()

    default_project.update(flags=F("flags").bitor(Project.flags.has_replays))
    assert cache[default_project.id] is True


@django_db_all
def test_has_sent_replays_cache_missing_or_false(default_project: Project) -> None:
    cache = make_has_sent_replays_cache()

    assert cache[default_project.id] is False

    # False value is still cached. This is expected behavior. In the implementation we'll
    # overwrite the false value with a true value.
    default_project.update(flags=F("flags").bitor(Project.flags.has_replays))
    assert cache[default_project.id] is False

    # Manual overwrites removes the false value and true can now be read.
    cache[default_project.id] = True
    assert cache[default_project.id] is True

    # Missing or invalid projects raise.
    with pytest.raises(DropEvent):
        cache[35165136121]


@django_db_all
def test_options_cache(default_project: Project) -> None:
    options_cache = make_options_cache()

    ProjectOption.objects.set_value(
        project=default_project, key="sentry:replay_hydration_error_issues", value=False
    )
    ProjectOption.objects.set_value(
        project=default_project, key="sentry:replay_rage_click_issues", value=False
    )

    assert options_cache[default_project.id][0] is False
    assert options_cache[default_project.id][1] is False


@django_db_all
def test_options_cache_hydration(default_project: Project) -> None:
    options_cache = make_options_cache()

    ProjectOption.objects.set_value(
        project=default_project, key="sentry:replay_hydration_error_issues", value=False
    )

    assert options_cache[default_project.id][0] is False
    assert options_cache[default_project.id][1] is True


@django_db_all
def test_options_cache_rage(default_project: Project) -> None:
    options_cache = make_options_cache()

    ProjectOption.objects.set_value(
        project=default_project, key="sentry:replay_rage_click_issues", value=False
    )

    assert options_cache[default_project.id][0] is True
    assert options_cache[default_project.id][1] is False


@django_db_all
def test_options_cache_missing(default_project: Project) -> None:
    options_cache = make_options_cache()

    assert options_cache[default_project.id][0] is True
    assert options_cache[default_project.id][1] is True

    assert options_cache[2346326722][0] is True
    assert options_cache[2346326722][1] is True
