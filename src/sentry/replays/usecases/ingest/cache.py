from typing import int
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.replays.lib.cache import AutoCache, BoundedLRUCache


def _has_replays_lookup(project_id: int) -> bool:
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        from sentry.replays.usecases.ingest import DropEvent

        raise DropEvent("Project does not exist.")

    assert isinstance(project, Project)
    return bool(project.flags.has_replays)


def _option_lookup(project_id: int) -> tuple[bool, bool]:
    default_options = {
        "sentry:replay_hydration_error_issues": True,
        "sentry:replay_rage_click_issues": True,
    }

    # We're intentionally manually looking up the options. We're avoided the project-options local
    # cache which exist on the preferred interface methods.
    options = ProjectOption.objects.filter(
        project_id=project_id,
        key__in=["sentry:replay_hydration_error_issues", "sentry:replay_rage_click_issues"],
    ).values_list("key", "value")

    for option in options:
        assert isinstance(option[0], str)
        assert isinstance(option[1], bool)
        default_options[option[0]] = option[1]

    # Skip storing the option names since they're redundant between cached entries and can be
    # inferred from index position.
    return (
        default_options["sentry:replay_hydration_error_issues"],
        default_options["sentry:replay_rage_click_issues"],
    )


def make_has_sent_replays_cache():
    return AutoCache(_has_replays_lookup, BoundedLRUCache(maxlen=10_000))


def make_options_cache():
    return AutoCache(_option_lookup, BoundedLRUCache(maxlen=10_000))
