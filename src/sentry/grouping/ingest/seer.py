from sentry import features
from sentry.constants import PLACEHOLDER_EVENT_TITLES
from sentry.eventstore.models import Event
from sentry.models.project import Project
from sentry.utils.safe import get_path


def should_call_seer_for_grouping(event: Event, project: Project) -> bool:
    """
    Use event content, feature flags, rate limits, killswitches, seer health, etc. to determine
    whether a call to Seer should be made.
    """
    # TODO: Implement rate limits, kill switches, other flags, etc
    # TODO: Return False if the event has a custom fingerprint (check for both client- and server-side fingerprints)

    # If an event has no stacktrace, and only one of our placeholder titles ("<untitled>",
    # "<unknown>", etc.), there's no data for Seer to analyze, so no point in making the API call.
    if (
        event.title in PLACEHOLDER_EVENT_TITLES
        and not get_path(event.data, "exception", "values", -1, "stacktrace", "frames")
        and not get_path(event.data, "threads", "values", -1, "stacktrace", "frames")
    ):
        return False

    return features.has("projects:similarity-embeddings-metadata", project) or features.has(
        "projects:similarity-embeddings-grouping", project
    )
