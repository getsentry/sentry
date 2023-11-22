from sentry.api.helpers.processing_issues import get_processing_issues
from sentry.models.eventerror import EventError
from sentry.models.processingissue import EventProcessingIssue, ProcessingIssue
from sentry.models.rawevent import RawEvent
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationProcessingIssuesTest(APITestCase):
    endpoint = "sentry-api-0-organization-processing-issues"

    def setUp(self):
        self.login_as(user=self.user)
        self.other_project = self.create_project(teams=[self.team], name="other")

    @freeze_time()
    def test_simple(self):
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
        response = self.get_success_response(
            self.project.organization.slug, project=[self.project.id]
        )
        assert len(response.data) == 1
        assert response.data[0] == expected[0]

        response = self.get_success_response(
            self.project.organization.slug, project=[self.project.id, self.other_project.id]
        )
        assert len(response.data) == 2
        assert list(sorted(response.data, key=lambda item: item["project"])) == expected
