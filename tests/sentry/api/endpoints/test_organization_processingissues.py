from __future__ import absolute_import

from exam import fixture
from freezegun import freeze_time

from sentry.api.helpers.processing_issues import get_processing_issues
from sentry.models import EventError, EventProcessingIssue, ProcessingIssue, RawEvent
from sentry.testutils import APITestCase


class OrganizationProcessingIssuesTest(APITestCase):
    endpoint = "sentry-api-0-organization-processing-issues"

    @fixture
    def user(self):
        return self.create_user()

    @fixture
    def team(self):
        team = self.create_team()
        self.create_team_membership(team, user=self.user)
        return team

    @fixture
    def project(self):
        return self.create_project(teams=[self.team], name="foo")

    @fixture
    def other_project(self):
        return self.create_project(teams=[self.team], name="other")

    @freeze_time()
    def test_simple(self):
        self.login_as(user=self.user)

        raw_event = RawEvent.objects.create(project_id=self.project.id, event_id="abc")

        issue = ProcessingIssue.objects.create(
            project_id=self.project.id, checksum="abc", type=EventError.NATIVE_MISSING_DSYM
        )

        EventProcessingIssue.objects.create(raw_event=raw_event, processing_issue=issue)

        ProcessingIssue.objects.create(
            project_id=self.other_project.id, checksum="abc", type=EventError.NATIVE_MISSING_DSYM
        )
        ProcessingIssue.objects.create(
            project_id=self.other_project.id, checksum="def", type=EventError.NATIVE_MISSING_SYMBOL
        )

        expected = get_processing_issues(self.user, [self.project, self.other_project])
        response = self.get_valid_response(
            self.project.organization.slug, project=[self.project.id]
        )
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0] == expected[0]

        response = self.get_valid_response(
            self.project.organization.slug, project=[self.project.id, self.other_project.id]
        )
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert list(sorted(response.data, key=lambda item: item["project"])) == expected
