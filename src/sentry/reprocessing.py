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
