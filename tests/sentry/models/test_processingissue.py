from unittest.mock import patch

from sentry.models.eventerror import EventError
from sentry.models.processingissue import (
    EventProcessingIssue,
    ProcessingIssue,
    ProcessingIssueManager,
    get_processing_issue_checksum,
)
from sentry.models.rawevent import RawEvent
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils.canonical import CanonicalKeyDict


@region_silo_test
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

    def test_with_no_release_dist(self):
        project = self.create_project(name="foo")

        scope = "ab"
        object = "cd"
        checksum = get_processing_issue_checksum(scope=scope, object=object)

        raw_event = RawEvent.objects.create(
            project_id=project.id,
            event_id="abc",
        )

        manager = ProcessingIssueManager()
        manager.record_processing_issue(
            raw_event=raw_event, scope=scope, object=object, type=EventError.NATIVE_MISSING_DSYM
        )

        issues = ProcessingIssue.objects.filter(
            project_id=project.id, checksum=checksum, type=EventError.NATIVE_MISSING_DSYM
        )
        assert len(issues) == 1
        assert issues[0].data == {
            "_object": object,
            "_scope": scope,
        }

        event_issues = EventProcessingIssue.objects.filter(
            raw_event=raw_event, processing_issue=issues[0]
        )
        assert len(event_issues) == 1

    def test_with_release_dist_pair_and_no_previous_issue(self):
        project = self.create_project(name="foo")
        release = self.create_release(version="1.0", project=project)
        dist = release.add_dist("android")

        scope = "ab"
        object = "cd"
        checksum = get_processing_issue_checksum(scope=scope, object=object)

        raw_event = RawEvent.objects.create(
            project_id=project.id,
            event_id="abc",
            data=CanonicalKeyDict({"release": release.version, "dist": dist.name}),
        )

        manager = ProcessingIssueManager()
        manager.record_processing_issue(
            raw_event=raw_event, scope=scope, object=object, type=EventError.NATIVE_MISSING_DSYM
        )

        issues = ProcessingIssue.objects.filter(
            project_id=project.id, checksum=checksum, type=EventError.NATIVE_MISSING_DSYM
        )
        assert len(issues) == 1
        assert issues[0].data == {
            "_object": object,
            "_scope": scope,
            "dist": dist.name,
            "release": release.version,
        }

        event_issues = EventProcessingIssue.objects.filter(
            raw_event=raw_event, processing_issue=issues[0]
        )
        assert len(event_issues) == 1

    def test_with_release_dist_pair_and_previous_issue_without_release_dist(self):
        project = self.create_project(name="foo")
        release = self.create_release(version="1.0", project=project)
        dist = release.add_dist("android")

        scope = "ab"
        object = "cd"
        checksum = get_processing_issue_checksum(scope=scope, object=object)

        raw_event = RawEvent.objects.create(
            project_id=project.id,
            event_id="abc",
            data=CanonicalKeyDict({"release": release.version, "dist": dist.name}),
        )

        ProcessingIssue.objects.create(
            project_id=project.id, checksum=checksum, type=EventError.NATIVE_MISSING_DSYM
        )

        manager = ProcessingIssueManager()
        manager.record_processing_issue(
            raw_event=raw_event, scope=scope, object=object, type=EventError.NATIVE_MISSING_DSYM
        )

        issues = ProcessingIssue.objects.filter(
            project_id=project.id, checksum=checksum, type=EventError.NATIVE_MISSING_DSYM
        )
        assert len(issues) == 1
        assert issues[0].data == {
            "dist": dist.name,
            "release": release.version,
        }

        event_issues = EventProcessingIssue.objects.filter(
            raw_event=raw_event, processing_issue=issues[0]
        )
        assert len(event_issues) == 1

    def test_with_release_dist_pair_and_previous_issue_with_release_dist(self):
        project = self.create_project(name="foo")

        # We want to create releases with different date_added.
        release = self.create_release(version="0.0", project=project)
        dist = release.add_dist("android")
        release_1 = self.create_release(version="1.0", project=project)
        dist_1 = release_1.add_dist("android")
        release_2 = self.create_release(version="2.0", project=project)
        dist_2 = release_2.add_dist("android")

        scope = "ab"
        object = "cd"
        checksum = get_processing_issue_checksum(scope=scope, object=object)

        for event_id, release, dist, expected_release, expected_dist in [
            ("abc", release_2.version, dist_2.name, release_2.version, dist_2.name),
            ("def", release.version, dist.name, release_1.version, dist_1.name),
        ]:
            issue = ProcessingIssue.objects.create(
                project_id=project.id,
                checksum=checksum,
                type=EventError.NATIVE_MISSING_DSYM,
                data={"release": release_1.version, "dist": dist_1.name},
            )

            raw_event = RawEvent.objects.create(
                project_id=project.id,
                event_id=event_id,
                data=CanonicalKeyDict({"release": release, "dist": dist}),
            )

            manager = ProcessingIssueManager()
            manager.record_processing_issue(
                raw_event=raw_event, scope=scope, object=object, type=EventError.NATIVE_MISSING_DSYM
            )

            issues = ProcessingIssue.objects.filter(
                project_id=project.id, checksum=checksum, type=EventError.NATIVE_MISSING_DSYM
            )
            assert len(issues) == 1
            assert issues[0].data == {
                "dist": expected_dist,
                "release": expected_release,
            }

            event_issues = EventProcessingIssue.objects.filter(
                raw_event=raw_event, processing_issue=issues[0]
            )
            assert len(event_issues) == 1

            issue.delete()

    @patch("sentry.models.processingissue.Release.objects.filter")
    def test_with_release_dist_pair_and_previous_issue_with_same_release_dist(self, release_filter):
        project = self.create_project(name="foo")
        release = self.create_release(version="1.0", project=project)
        dist_1 = release.add_dist("android")
        dist_2 = release.add_dist("ios")

        scope = "ab"
        object = "cd"
        checksum = get_processing_issue_checksum(scope=scope, object=object)

        raw_event = RawEvent.objects.create(
            project_id=project.id,
            event_id="abc",
            data=CanonicalKeyDict({"release": release.version, "dist": dist_2.name}),
        )

        ProcessingIssue.objects.create(
            project_id=project.id,
            checksum=checksum,
            type=EventError.NATIVE_MISSING_DSYM,
            data={"release": release.version, "dist": dist_1.name},
        )

        manager = ProcessingIssueManager()
        manager.record_processing_issue(
            raw_event=raw_event, scope=scope, object=object, type=EventError.NATIVE_MISSING_DSYM
        )

        release_filter.assert_not_called()

        issues = ProcessingIssue.objects.filter(
            project_id=project.id, checksum=checksum, type=EventError.NATIVE_MISSING_DSYM
        )
        assert len(issues) == 1
        assert issues[0].data == {
            "dist": dist_2.name,
            "release": release.version,
        }

        event_issues = EventProcessingIssue.objects.filter(
            raw_event=raw_event, processing_issue=issues[0]
        )
        assert len(event_issues) == 1
