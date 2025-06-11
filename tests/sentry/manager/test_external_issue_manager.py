from sentry.eventstore.models import GroupEvent
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.services.integration.serial import serialize_integration
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba

pytestmark = requires_snuba


class ExternalIssueManagerTest(TestCase):
    def setUp(self):
        self.project = self.create_project(organization=self.organization)
        self.integration1 = self.create_integration(
            organization=self.organization, external_id="example:1", provider="example"
        )
        self.api_integration1 = serialize_integration(self.integration1)
        self.integration2 = self.create_integration(
            organization=self.organization, external_id="example:2", provider="example"
        )
        self.api_integration2 = serialize_integration(self.integration2)
        self.integration3 = self.create_integration(
            organization=self.create_organization(), external_id="example:3", provider="example"
        )
        self.api_integration3 = serialize_integration(self.integration3)

        self.event1 = self.store_event(
            data={"event_id": "a" * 32, "message": "ooop"},
            project_id=self.project.id,
        )
        self.event2 = self.store_event(
            data={"event_id": "b" * 32, "message": "boop"},
            project_id=self.project.id,
        )

        assert self.event1.group is not None
        self.group_event1 = GroupEvent.from_event(self.event1, self.event1.group)
        assert self.event2.group is not None
        self.group_event2 = GroupEvent.from_event(self.event2, self.event2.group)
        self.external_issue1 = self.create_integration_external_issue(
            group=self.event1.group, integration=self.integration1, key="ABC-123"
        )
        self.external_issue2 = self.create_integration_external_issue(
            group=self.event2.group, integration=self.integration1, key="DEF-456"
        )
        self.external_issue3 = self.create_integration_external_issue(
            group=self.event1.group, integration=self.integration2, key="GHI-789"
        )

    def test_get_for_integration(self):
        # Base case
        result = ExternalIssue.objects.get_for_integration(integration=self.api_integration1)
        assert len(result) == 2
        for ei in [self.external_issue1, self.external_issue2]:
            assert ei in result
        # Empty case
        result = ExternalIssue.objects.get_for_integration(integration=self.api_integration3)
        assert len(result) == 0
        # Key provided case
        result = ExternalIssue.objects.get_for_integration(
            integration=self.api_integration1, external_issue_key=self.external_issue2.key
        )
        assert len(result) == 1
        assert self.external_issue2 in result

    def test_get_linked_issues(self):
        # Base case
        result = ExternalIssue.objects.get_linked_issues(
            event=self.group_event1, integration=self.api_integration1
        )
        assert len(result) == 1
        assert self.external_issue1 in result
        external_issue4 = self.create_integration_external_issue(
            group=self.event1.group, integration=self.integration1, key="JKL-000"
        )
        result = ExternalIssue.objects.get_linked_issues(
            event=self.group_event1, integration=self.api_integration1
        )
        assert len(result) == 2
        for ei in [self.external_issue1, external_issue4]:
            assert ei in result
        # Empty case
        result = ExternalIssue.objects.get_linked_issues(
            event=self.group_event2, integration=self.api_integration2
        )
        assert len(result) == 0

    def test_has_linked_issue(self):
        # Base case
        result = ExternalIssue.objects.has_linked_issue(
            event=self.group_event1, integration=self.api_integration1
        )
        assert result
        event = self.store_event(
            data={"event_id": "a" * 32, "message": "new event"},
            project_id=self.project.id,
        )
        assert event.group is not None
        group_event = GroupEvent.from_event(event, event.group)
        # Empty case
        result = ExternalIssue.objects.has_linked_issue(
            event=group_event, integration=self.api_integration1
        )
        assert not result
        # Update case
        self.create_integration_external_issue(
            group=event.group, integration=self.integration1, key="JKL-000"
        )
        result = ExternalIssue.objects.has_linked_issue(
            event=group_event, integration=self.api_integration1
        )
        assert result
