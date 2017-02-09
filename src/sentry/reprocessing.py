from __future__ import absolute_import


def report_processing_issue(event_data, scope, object=None, type=None, data=None):
    """Reports a processing issue for a given scope and object.  Per
    scope/object combination only one issue can be recorded where the last
    one reported wins.
    """
    if object is None:
        object = '*'
    if type is None:
        from sentry.models import EventError
        type = EventError.INVALID_DATA
    uid = '%s:%s' % (scope, object)
    event_data.setdefault('processing_issues', {})[uid] = {
        'scope': scope,
        'object': object,
        'type': type,
        'data': data,
    }


def resolve_processing_issue(project, scope, object=None, type=None):
    """Given a project, scope and object (and optionally a type) this marks
    affected processing issues are resolved and kicks off a task to move
    events back to reprocessing.
    """
    if object is None:
        object = '*'
    from sentry.models import ProcessingIssue
    ProcessingIssue.objects.resolve_processing_issue(
        project=project, scope=scope, object=object, type=type)


def trigger_reprocessing(project):
    from sentry.tasks.reprocessing import reprocess_events
    reprocess_events.delay(project_id=project.id)
