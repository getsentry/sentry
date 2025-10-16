from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.replays.lib.cache import AutoCache, BoundedLRUCache


def _has_replays_lookup(project_id: int) -> bool:
    project = Project.objects.get(id=project_id)
    assert isinstance(project, Project)
    return project.flags.has_replays


def _option_lookup(project_id: int) -> tuple[bool, bool]:
    default_options = {
        "sentry:replay_hydration_error_issues": False,
        "sentry:replay_rage_click_issues": False,
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


# TODO: Global cache singletons for our ingest pipeline. This not ideal. I would much prefer if
# these were dependency injected into the function which needs them. But doing so right away would
# take a decent amount of time and complicate the diff. Making the change in this way means we
# have similar semantics to what exists already, we can deploy and validate faster, and then
# refactor the consumer code as part of a dedicated effort to make it better.
has_sent_replays_cache = AutoCache(_has_replays_lookup, BoundedLRUCache(maxlen=10_000))
options_cache = AutoCache(_option_lookup, BoundedLRUCache(maxlen=10_000))
