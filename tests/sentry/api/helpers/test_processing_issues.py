# -*- coding: utf-8 -*-

from __future__ import absolute_import

from exam import fixture

from sentry.api.helpers.processing_issues import get_processing_issues
from sentry.models import (
    EventError,
    EventProcessingIssue,
    ProcessingIssue,
    RawEvent,
    ReprocessingReport,
)
from sentry.testutils import TestCase


class GetProcessingIssuesTest(TestCase):
    @fixture
    def user(self):
        return self.create_user()

    @fixture
    def project(self):
        return self.create_project(name="foo")

    def test_no_issues(self):
        result = get_processing_issues(self.user, [self.project])[0]
        assert not result["hasIssues"]
        assert not result["hasMoreResolveableIssues"]
        assert result["numIssues"] == 0
        assert result["issuesProcessing"] == 0
        assert result["resolveableIssues"] == 0

    def test_simple(self):
        raw_event = RawEvent.objects.create(project_id=self.project.id, event_id="abc")

        issue, _ = ProcessingIssue.objects.get_or_create(
            project_id=self.project.id, checksum="abc", type=EventError.NATIVE_MISSING_DSYM
        )

        EventProcessingIssue.objects.get_or_create(raw_event=raw_event, processing_issue=issue)

        result = get_processing_issues(self.user, [self.project])[0]
        assert result["hasIssues"]
        assert not result["hasMoreResolveableIssues"]
        assert result["numIssues"] == 1
        assert result["issuesProcessing"] == 0
        assert result["resolveableIssues"] == 0

    def test_full(self):
        issue = ProcessingIssue.objects.create(
            project_id=self.project.id, checksum="abc", type=EventError.NATIVE_MISSING_DSYM
        )

        raw_event = RawEvent.objects.create(project_id=self.project.id, event_id="abc")
        EventProcessingIssue.objects.create(raw_event=raw_event, processing_issue=issue)
        RawEvent.objects.create(project_id=self.project.id, event_id="jkl")
        ReprocessingReport.objects.create(project=self.project, event_id="abc")
        ReprocessingReport.objects.create(project=self.project, event_id="def")

        ProcessingIssue.objects.create(
            project_id=self.project.id, checksum="def", type=EventError.NATIVE_INTERNAL_FAILURE
        )
        ProcessingIssue.objects.create(
            project_id=self.project.id, checksum="jkl", type=EventError.NATIVE_MISSING_SYMBOL
        )

        result = get_processing_issues(self.user, [self.project])[0]
        assert result["hasIssues"]
        assert not result["hasMoreResolveableIssues"]
        assert result["numIssues"] == 3
        assert result["issuesProcessing"] == 2
        assert result["resolveableIssues"] == 1

    def test_multi_project_full(self):
        issue = ProcessingIssue.objects.create(
            project_id=self.project.id, checksum="abc", type=EventError.NATIVE_MISSING_DSYM
        )

        raw_event = RawEvent.objects.create(project_id=self.project.id, event_id="abc")
        EventProcessingIssue.objects.create(raw_event=raw_event, processing_issue=issue)
        RawEvent.objects.create(project_id=self.project.id, event_id="jkl")
        ReprocessingReport.objects.create(project=self.project, event_id="abc")
        ReprocessingReport.objects.create(project=self.project, event_id="def")

        ProcessingIssue.objects.create(
            project_id=self.project.id, checksum="def", type=EventError.NATIVE_INTERNAL_FAILURE
        )
        ProcessingIssue.objects.create(
            project_id=self.project.id, checksum="jkl", type=EventError.NATIVE_MISSING_SYMBOL
        )

        other_project = self.create_project(name="other")
        ProcessingIssue.objects.create(
            project_id=other_project.id, checksum="abc", type=EventError.NATIVE_MISSING_DSYM
        )
        ReprocessingReport.objects.create(project=other_project, event_id="abc")
        RawEvent.objects.create(project_id=other_project.id, event_id="def")
        RawEvent.objects.create(project_id=other_project.id, event_id="jkl")

        results = get_processing_issues(self.user, [self.project, other_project])
        assert results[0]["hasIssues"]
        assert not results[0]["hasMoreResolveableIssues"]
        assert results[0]["numIssues"] == 3
        assert results[0]["issuesProcessing"] == 2
        assert results[0]["resolveableIssues"] == 1
        assert results[0]["project"] == self.project.slug

        assert results[1]["hasIssues"]
        assert not results[1]["hasMoreResolveableIssues"]
        assert results[1]["numIssues"] == 1
        assert results[1]["issuesProcessing"] == 1
        assert results[1]["resolveableIssues"] == 2
        assert results[1]["project"] == other_project.slug
