from dataclasses import dataclass

from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration import Integration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.interfaces.user import User
from sentry.issues.services.issue.model import RpcLinkedIssueSummary
from sentry.issues.services.issue.service import issue_service
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test, create_test_regions


@dataclass
class HcExternalIssueContext:
    org_owner: User
    region_name: str
    organization: Organization
    project: Project


@all_silo_test(regions=create_test_regions("de", "us"))
class TestIssueService(TestCase):
    def setUp(self):
        super().setUp()
        self.default_jira_integration = self.create_integration(
            provider=IntegrationProviderSlug.JIRA.value,
            organization=self.organization,
            external_id="jira-123",
            name="Jira",
        )
        self.us_region_context = self.create_region_context(
            "us",
            org_owner=self.create_user(email="us_test@example.com"),
            integration=self.default_jira_integration,
        )
        self.de_region_context = self.create_region_context(
            "de",
            org_owner=self.create_user(email="de_test@example.com"),
            integration=self.default_jira_integration,
        )

    def create_region_context(
        self,
        region_name: str,
        org_owner: User | None = None,
        integration: Integration | None = None,
    ) -> HcExternalIssueContext:
        organization = self.create_organization(
            name="test_org",
            slug="test",
            owner=org_owner,
            region=region_name,
        )

        project = self.create_project(organization=organization)

        return HcExternalIssueContext(
            region_name=region_name,
            organization=organization,
            project=project,
            org_owner=org_owner,
        )

    def create_linked_issue(
        self,
        key: str,
        region_context: HcExternalIssueContext,
        group: Group,
        integration: Integration,
        title: str | None = None,
    ) -> ExternalIssue:

        external_issue = self.create_integration_external_issue(
            organization=region_context.organization,
            group=group,
            integration=integration,
            key=key,
            title=title,
        )

        return external_issue

    def test_get_linked_issues(self):
        group = self.create_group(project=self.us_region_context.project)
        self.create_linked_issue(
            key="TEST-123",
            region_context=self.us_region_context,
            group=group,
            integration=self.default_jira_integration,
            title="US Group Link",
        )

        response = issue_service.get_linked_issues(
            region_name=self.us_region_context.region_name,
            integration_id=self.default_jira_integration.id,
            organization_ids=[self.us_region_context.organization.id],
            external_issue_key="TEST-123",
        )

        assert response == [
            RpcLinkedIssueSummary(
                issue_link=group.get_absolute_url(),
                title=group.title,
            )
        ]

    def test_get_linked_issues_with_multiple_organizations_in_multiple_regions(self):
        us_group = self.create_group(project=self.us_region_context.project)
        us_linked_issue = self.create_linked_issue(
            key="TEST-123",
            region_context=self.us_region_context,
            group=us_group,
            integration=self.default_jira_integration,
            title="US Group Link",
        )

        de_group = self.create_group(project=self.de_region_context.project)
        de_linked_issue = self.create_linked_issue(
            key="TEST-123",
            region_context=self.de_region_context,
            group=de_group,
            integration=self.default_jira_integration,
            title="DE Group Link",
        )

        response = issue_service.get_linked_issues(
            region_name=self.us_region_context.region_name,
            integration_id=self.default_jira_integration.id,
            organization_ids=[
                self.us_region_context.organization.id,
                self.de_region_context.organization.id,
            ],
            external_issue_key="TEST-123",
        )

        assert response == [
            RpcLinkedIssueSummary(
                issue_link=us_group.get_absolute_url(),
                title=us_linked_issue.title,
            ),
            RpcLinkedIssueSummary(
                issue_link=de_group.get_absolute_url(),
                title=de_linked_issue.title,
            ),
        ]

    def test_get_empty_response_when_no_linked_issues(self):
        response = issue_service.get_linked_issues(
            region_name=self.us_region_context.region_name,
            integration_id=self.default_jira_integration.id,
            organization_ids=[self.us_region_context.organization.id],
            external_issue_key="TEST-123",
        )

        assert response == []

    def test_get_single_linked_issue_when_multiple_organizations_share_integration(self):
        us_group = self.create_group(project=self.us_region_context.project)
        us_linked_issue = self.create_linked_issue(
            key="TEST-123",
            region_context=self.us_region_context,
            group=us_group,
            integration=self.default_jira_integration,
            title="US Group Link",
        )

        response = issue_service.get_linked_issues(
            region_name=self.us_region_context.region_name,
            integration_id=self.default_jira_integration.id,
            organization_ids=[self.us_region_context.organization.id],
            external_issue_key="TEST-123",
        )

        assert response == [
            RpcLinkedIssueSummary(
                issue_link=us_group.get_absolute_url(),
                title=us_linked_issue.title,
            )
        ]

    def test_filters_out_issues_from_other_organizations(self):
        us_group = self.create_group(project=self.us_region_context.project)
        us_linked_issue = self.create_linked_issue(
            key="TEST-123",
            region_context=self.us_region_context,
            group=us_group,
            integration=self.default_jira_integration,
            title="US Group Link",
        )

        other_integration = self.create_integration(
            provider=IntegrationProviderSlug.JIRA.value,
            organization=self.organization,
            external_id="jira-456",
            name="Other Jira",
        )

        unrelated_us_group = self.create_group(project=self.us_region_context.project)
        # Create another linked issue with the same key but different integration.
        self.create_linked_issue(
            key="TEST-123",
            region_context=self.us_region_context,
            group=unrelated_us_group,
            integration=other_integration,
            title="Unrelated US Group Link",
        )

        response = issue_service.get_linked_issues(
            region_name=self.us_region_context.region_name,
            integration_id=self.default_jira_integration.id,
            organization_ids=[self.us_region_context.organization.id],
            external_issue_key="TEST-123",
        )

        assert response == [
            RpcLinkedIssueSummary(
                issue_link=us_group.get_absolute_url(),
                title=us_linked_issue.title,
            )
        ]
