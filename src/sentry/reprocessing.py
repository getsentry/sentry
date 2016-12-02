from __future__ import absolute_import

from sentry.models import ProcessingIssue, ProcessingIssueGroup


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
