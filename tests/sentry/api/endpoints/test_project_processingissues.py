from __future__ import absolute_import

from datetime import datetime
from django.utils import timezone
from django.core.urlresolvers import reverse

from sentry.models import ProcessingIssue, EventError, RawEvent, EventProcessingIssue
from sentry.testutils import APITestCase


class ProjectProjectProcessingIssuesTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        team = self.create_team()
        project1 = self.create_project(teams=[team], name="foo")

        raw_event = RawEvent.objects.create(project_id=project1.id, event_id="abc")

        issue, _ = ProcessingIssue.objects.get_or_create(
            project_id=project1.id, checksum="abc", type=EventError.NATIVE_MISSING_DSYM
        )

        EventProcessingIssue.objects.get_or_create(raw_event=raw_event, processing_issue=issue)

        url = reverse(
            "sentry-api-0-project-processing-issues",
            kwargs={"organization_slug": project1.organization.slug, "project_slug": project1.slug},
        )
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data["hasIssues"] is True
        assert response.data["hasMoreResolveableIssues"] is False
        assert response.data["numIssues"] == 1
        assert response.data["issuesProcessing"] == 0
        assert response.data["resolveableIssues"] == 0

    def test_issues(self):
        self.login_as(user=self.user)

        team = self.create_team()
        project1 = self.create_project(teams=[team], name="foo")

        raw_event = RawEvent.objects.create(project_id=project1.id, event_id="abc")

        issue, _ = ProcessingIssue.objects.get_or_create(
            project_id=project1.id,
            checksum="abc",
            type=EventError.NATIVE_MISSING_DSYM,
            datetime=datetime(2013, 8, 13, 3, 8, 25, tzinfo=timezone.utc),
        )

        issue2, _ = ProcessingIssue.objects.get_or_create(
            project_id=project1.id,
            checksum="abcd",
            type=EventError.NATIVE_MISSING_DSYM,
            datetime=datetime(2014, 8, 13, 3, 8, 25, tzinfo=timezone.utc),
        )

        EventProcessingIssue.objects.get_or_create(raw_event=raw_event, processing_issue=issue)

        url = reverse(
            "sentry-api-0-project-processing-issues",
            kwargs={"organization_slug": project1.organization.slug, "project_slug": project1.slug},
        )
        response = self.client.get(url + "?detailed=1", format="json")
        assert response.status_code == 200, response.content
        assert len(response.data["issues"]) == 2
        assert response.data["numIssues"] == 2
        assert response.data["lastSeen"] == issue2.datetime
        assert response.data["hasIssues"] is True
        assert response.data["hasMoreResolveableIssues"] is False
        assert response.data["issuesProcessing"] == 0
        assert response.data["resolveableIssues"] == 0
        assert response.data["issues"][0]["checksum"] == issue.checksum
        assert response.data["issues"][0]["numEvents"] == 1
        assert response.data["issues"][0]["type"] == EventError.NATIVE_MISSING_DSYM
        assert response.data["issues"][1]["checksum"] == issue2.checksum

    def test_resolvable_issues(self):
        self.login_as(user=self.user)

        team = self.create_team()
        project1 = self.create_project(teams=[team], name="foo")

        RawEvent.objects.create(project_id=project1.id, event_id="abc")

        url = reverse(
            "sentry-api-0-project-processing-issues",
            kwargs={"organization_slug": project1.organization.slug, "project_slug": project1.slug},
        )
        response = self.client.get(url + "?detailed=1", format="json")
        assert response.status_code == 200, response.content
        assert response.data["numIssues"] == 0
        assert response.data["resolveableIssues"] == 1
        assert response.data["lastSeen"] is None
        assert response.data["hasIssues"] is False
        assert response.data["hasMoreResolveableIssues"] is False
        assert response.data["numIssues"] == 0
        assert response.data["issuesProcessing"] == 0
