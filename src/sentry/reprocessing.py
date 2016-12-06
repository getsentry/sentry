from __future__ import absolute_import

from sentry.models import ProcessingIssue, ProcessingIssueGroup, GroupStatus, \
    Event
from sentry.utils.query import batched_queryset_iter
from sentry.tasks.store import preprocess_event


def record_processing_issue(event_data, type, key, release_bound=True,
                            data=None, group_data=None, hold_group=True):
    """Records a processing issue with the event data.  When the event is
    later stored we will persist these event issues in the database to
    permit reprocessing when they are fixed.
    """
    if hold_group:
        event_data['on_hold'] = True
    event_data.setdefault('processing_issues', []).append({
        'type': type,
        'key': key,
        'release_bound': release_bound,
        'issue_data': data or {},
        'group_data': group_data or {},
    })


def store_processing_issues(issues, group, release=None):
    for d in issues:
        issue = ProcessingIssue.objects.get_or_create(
            project=group.project,
            type=d['type'],
            key=d['key'],
            defaults={'data': d['issue_data']},
        )[0]
        ProcessingIssueGroup.objects.get_or_create(
            group=group,
            release=release,
            issue=issue,
            defaults={'data': d['group_data']},
        )[0]


def trigger_reprocessing(project, type, key=None):
    """Triggers reprocessing of issues for the given project and type.  If
    a key is given only groups matching that key are reprocessed.
    """
    q = ProcessingIssueGroup.objects.filter(
        issue__project=project,
        issue__type=type,
        group__status=GroupStatus.ON_HOLD
    )
    if key is not None:
        q = q.filter(issue__key=key)

    for pig in q.select_related('group'):
        pig.group.project = project
        trigger_group_reprocessing(pig.group)


def trigger_group_reprocessing(group):
    """Triggers reprocessing for an entire group."""
    # Sanity check just in case
    if group.status != GroupStatus.ON_HOLD:
        return

    q = Event.objects.filter(group=group)

    for events in batched_queryset_iter(q):
        Event.objects.bind_nodes(events, 'data')
        for event in events:
            preprocess_event.delay(
                data=event.data,
                reprocesses_event_id=event.id
            )
