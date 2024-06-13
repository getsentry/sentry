import logging
from collections.abc import Mapping
from typing import Any

# Is reprocessing on or off by default?
REPROCESSING_DEFAULT = False
REPROCESSING_OPTION = "sentry:reprocessing_active"
# TODO: make sure to clean these option up at some point:
REPROCESSING_REVISION_OPTION = "sentry:processing-rev"
SENT_NOTIFICATION_OPTION = "sentry:sent_failed_event_hint"


logger = logging.getLogger("sentry.events")


def event_supports_reprocessing(data: Mapping[str, Any]) -> bool:
    """Only events of a certain format support reprocessing."""
    from sentry.lang.native.utils import NATIVE_PLATFORMS
    from sentry.stacktraces.platform import JAVASCRIPT_PLATFORMS
    from sentry.stacktraces.processing import find_stacktraces_in_data

    platform = data.get("platform")
    if platform in NATIVE_PLATFORMS:
        return True
    elif platform == "java" and data.get("debug_meta"):
        return True
    elif platform not in JAVASCRIPT_PLATFORMS:
        return False
    for stacktrace_info in find_stacktraces_in_data(data):
        if not stacktrace_info.platforms.isdisjoint(NATIVE_PLATFORMS):
            return True
    return False


def resolve_processing_issue(project, scope, object=None, type=None):
    """Given a project, scope and object (and optionally a type) this marks
    affected processing issues are resolved and kicks off a task to move
    events back to reprocessing.
    """
    if object is None:
        object = "*"
    from sentry.models.processingissue import ProcessingIssue

    ProcessingIssue.objects.resolve_processing_issue(
        project=project, scope=scope, object=object, type=type
    )


def trigger_reprocessing(project):
    from sentry.tasks.reprocessing import reprocess_events

    reprocess_events.delay(project_id=project.id)
