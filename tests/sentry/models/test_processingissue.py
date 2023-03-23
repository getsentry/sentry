from sentry.models import (
    EventError,
    EventProcessingIssue,
    ProcessingIssue,
    ProcessingIssueManager,
    RawEvent,
)
from sentry.testutils import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils.canonical import CanonicalKeyDict


@region_silo_test(stable=True)
class ProcessingIssueTest(TestCase):
    def test_simple(self):
        team = self.create_team()
        project1 = self.create_project(teams=[team], name="foo")

        raw_event = RawEvent.objects.create(project_id=project1.id, event_id="abc")

        issue, _ = ProcessingIssue.objects.get_or_create(
            project_id=project1.id, checksum="abc", type=EventError.NATIVE_MISSING_DSYM
        )

        event_processing_issue = EventProcessingIssue.objects.get_or_create(
            raw_event=raw_event, processing_issue=issue
        )
        assert event_processing_issue is not None
        assert EventProcessingIssue.objects.count() == 1

        issue.delete()

        assert EventProcessingIssue.objects.count() == 0

    def test_with_release_dist(self):
        team = self.create_team()
        project = self.create_project(teams=[team], name="foo")
        release = self.create_release(version="1.0")
        dist = release.add_dist("android")

        raw_event_data = CanonicalKeyDict({"release": release.version, "dist": dist.name})
        raw_event = RawEvent.objects.create(
            project_id=project.id, event_id="abc", data=raw_event_data
        )

        manager = ProcessingIssueManager()
        manager.record_processing_issue(
            raw_event=raw_event, scope="a", object="", type=EventError.NATIVE_MISSING_DSYM
        )
