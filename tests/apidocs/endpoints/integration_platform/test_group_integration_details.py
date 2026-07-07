from django.test.client import RequestFactory

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.models.grouplink import GroupLink
from sentry.testutils.factories import EventType
from sentry.testutils.helpers.datetime import before_now


class GroupIntegrationDetailsDocs(APIDocsTestCase):
    def setUp(self) -> None:
        self.event = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": before_now(minutes=1).isoformat(),
                "message": "message",
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        self.group = self.event.group
        self.integration = self.create_integration(
            organization=self.organization,
            provider="example",
            name="Example",
            external_id="example:1",
        )
        self.base_url = (
            f"/api/0/organizations/{self.organization.slug}/issues/"
            f"{self.group.id}/integrations/{self.integration.id}/"
        )

        self.login_as(user=self.user)

    def test_get(self) -> None:
        url = f"{self.base_url}?action=create"
        with self.feature("organizations:integrations-issue-basic"):
            response = self.client.get(url)
        request = RequestFactory().get(url)

        self.validate_schema(request, response)

    def test_post(self) -> None:
        data = {"assignee": "foo@example.com"}
        with self.feature("organizations:integrations-issue-basic"):
            response = self.client.post(self.base_url, data=data)
        request = RequestFactory().post(self.base_url, data=data)

        self.validate_schema(request, response)

    def test_put(self) -> None:
        data = {"externalIssue": "APP-123"}
        with self.feature("organizations:integrations-issue-basic"):
            response = self.client.put(self.base_url, data=data)
        request = RequestFactory().put(self.base_url, data=data)

        self.validate_schema(request, response)

    def test_delete(self) -> None:
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            key="APP-123",
        )
        GroupLink.objects.create(
            group_id=self.group.id,
            project_id=self.group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )
        url = f"{self.base_url}?externalIssue={external_issue.id}"
        with self.feature("organizations:integrations-issue-basic"):
            response = self.client.delete(url)
        request = RequestFactory().delete(url)

        self.validate_schema(request, response)
