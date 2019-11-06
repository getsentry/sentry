from __future__ import absolute_import

import uuid
import logging


REPROCESSING_OPTION = "sentry:processing-rev"


logger = logging.getLogger("sentry.events")


def event_supports_reprocessing(data):
    """Only events of a certain format support reprocessing."""
    from sentry.stacktraces.processing import find_stacktraces_in_data
    from sentry.stacktraces.platform import NATIVE_PLATFORMS, JAVASCRIPT_PLATFORMS

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


def get_reprocessing_revision(project, cached=True):
    """Returns the current revision of the projects reprocessing config set."""
    from sentry.models import ProjectOption, Project

    if cached:
        return ProjectOption.objects.get_value(project, REPROCESSING_OPTION)
    try:
        if isinstance(project, Project):
            project = project.id
        return ProjectOption.objects.get(project=project, key=REPROCESSING_OPTION).value
    except ProjectOption.DoesNotExist:
        pass


def bump_reprocessing_revision(project):
    """Bumps the reprocessing revision."""
    from sentry.models import ProjectOption

    rev = uuid.uuid4().hex
    ProjectOption.objects.set_value(project, REPROCESSING_OPTION, rev)
    return rev


def report_processing_issue(event_data, scope, object=None, type=None, data=None):
    """Reports a processing issue for a given scope and object.  Per
    scope/object combination only one issue can be recorded where the last
    one reported wins.
    """
    if object is None:
        object = "*"
    if type is None:
        from sentry.models import EventError

        type = EventError.INVALID_DATA

    # This really should not happen.
    if not event_supports_reprocessing(event_data):
        logger.error("processing_issue.bad_report", extra={"platform": event_data.get("platform")})
        return

    uid = "%s:%s" % (scope, object)
    event_data.setdefault("processing_issues", {})[uid] = {
        "scope": scope,
        "object": object,
        "type": type,
        "data": data,
    }


def resolve_processing_issue(project, scope, object=None, type=None):
    """Given a project, scope and object (and optionally a type) this marks
    affected processing issues are resolved and kicks off a task to move
    events back to reprocessing.
    """
    if object is None:
        object = "*"
    from sentry.models import ProcessingIssue

    ProcessingIssue.objects.resolve_processing_issue(
        project=project, scope=scope, object=object, type=type
    )


def trigger_reprocessing(project):
    from sentry.tasks.reprocessing import reprocess_events

    reprocess_events.delay(project_id=project.id)
