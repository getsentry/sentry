from __future__ import absolute_import

from sentry.models import EventError


def report_processing_issue(event_data, scope, object=None, type=None, data=None):
    """Reports a processing issue for a given scope and object.  Per
    scope/object combination only one issue can be recorded where the last
    one reported wins.
    """
    if object is None:
        object = '*'
    if type is None:
        type = EventError.INVALID_DATA
    uid = '%s:%s' % (scope, object)
    event_data.setdefault('processing_issues', {})[uid] = {
        'scope': scope,
        'object': object,
        'type': type,
        'data': data,
    }


def resolve_processing_issue(project, scope, object=None, type=None):
    if object is None:
        object = '*'
    from sentry.models import ProcessingIssue
    from sentry.tasks.store import reprocess_events
    raw_event_ids = ProcessingIssue.objects.resolve_processing_issue(
        project=project,
        scope=scope,
        object=object,
        type=type
    )
    reprocess_events.delay(raw_event_ids=raw_event_ids)
