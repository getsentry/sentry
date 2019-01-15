from __future__ import absolute_import

from sentry.models import (ProcessingIssue, EventError, RawEvent, EventProcessingIssue)
from sentry.testutils import TestCase


class ProcessingIssueTest(TestCase):
    def test_simple(self):
        team = self.create_team()
        project1 = self.create_project(teams=[team], name='foo')

        raw_event = RawEvent.objects.create(project_id=project1.id, event_id='abc')

        issue, _ = ProcessingIssue.objects.get_or_create(
            project_id=project1.id, checksum='abc', type=EventError.NATIVE_MISSING_DSYM
        )

        event_processing_issue = EventProcessingIssue.objects.get_or_create(
            raw_event=raw_event,
            processing_issue=issue,
        )
        assert event_processing_issue is not None
        assert EventProcessingIssue.objects.count() == 1

        issue.delete()

        assert EventProcessingIssue.objects.count() == 0


class FindResolvedTest(TestCase):
    def test_has_processing_issues(self):
        results, has_more = ProcessingIssue.objects.find_resolved(self.project.id)
        assert results == []
        assert not has_more

        self.create_event_processing_issue(
            raw_event=self.create_raw_event(),
            processing_issue=self.create_processing_issue(),
        )
        results, has_more = ProcessingIssue.objects.find_resolved(self.project.id)
        assert results == []
        assert not has_more

    def test_has_more(self):
        raw_events = [self.create_raw_event() for _ in xrange(3)]
        results, has_more = ProcessingIssue.objects.find_resolved(self.project.id, limit=2)
        assert results == raw_events[:2]
        assert has_more
        results, has_more = ProcessingIssue.objects.find_resolved(self.project.id, limit=3)
        assert results == raw_events
        assert not has_more
