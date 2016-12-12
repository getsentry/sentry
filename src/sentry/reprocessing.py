from __future__ import absolute_import

from sentry.models import ProcessingIssue, ProcessingIssueGroup, Event
from sentry.utils.query import batched_queryset_iter
from sentry.tasks.store import preprocess_event


def record_processing_issue(event_data, type, key, release_bound=True,
                            data=None, group_data=None, hold_group=True):
    """Records a processing issue with the event data.  When the event is
    later stored we will persist these event issues in the database to
    permit reprocessing when they are fixed.
    """
    if hold_group:
        event_data['unprocessed'] = True
    event_data.setdefault('processing_issues', []).append({
        'type': type,
        'key': key,
        'release_bound': release_bound,
        'issue_data': data or {},
        'group_data': group_data or {},
    })


def resolve_processing_issue(project, type, key=None):
    """Resolves a processing issue.  This might trigger reprocessing."""
    q = ProcessingIssueGroup.objects.filter(
        issue__project=project,
        issue__type=type
    )
    if key is not None:
        q = q.filter(issue__key=key)

    affected_groups = set()
    affected_issues = set()
    affected_pigs = []
    for pig in q:
        affected_groups.add(pig.group_id)
        affected_issues.add(pig.issue_id)
        affected_pigs.append(pig.id)

    if not affected_groups:
        return

    ProcessingIssueGroup.objects.filter(pk__in=affected_pigs).delete()
    ProcessingIssue.objects.filter(pk__in=affected_issues).delete()

    q = ProcessingIssueGroup.objects.filter(
        issue__project=project,
        group__pk__in=list(affected_groups)
    )
    broken_groups = set(x.id for x in q)

    for group_id in affected_groups:
        if group_id not in broken_groups:
            _trigger_group_reprocessing(group_id)


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


def _trigger_group_reprocessing(group_id):
    """Triggers reprocessing for an entire group."""
    q = Event.objects.filter(group_id=group_id)
    for events in batched_queryset_iter(q):
        Event.objects.bind_nodes(events, 'data')
        for event in events:
            preprocess_event.delay(
                data=event.data,
                reprocesses_event_id=event.id
            )
