from sentry.api.serializers import serialize
from sentry.integrations.api.serializers.models.external_issue import ExternalIssueSerializer
from sentry.testutils.cases import TestCase


class ExternalIssueSerializerTestCase(TestCase):
    def test_external_issue_serializer(self):
        # integrations and external issues for group 1
        group_1 = self.create_group()
        integration_jira = self.create_integration(
            organization=group_1.organization,
            provider="jira",
            external_id="jira_external_id",
            name="Jira",
            metadata={"base_url": "https://example.com", "domain_name": "test/"},
        )
        integration_github = self.create_integration(
            organization=group_1.organization,
            provider="github",
            external_id="github_external_id",
            name="GitHub",
            metadata={"base_url": "https://example.com", "domain_name": "test/"},
        )
        external_issue_1a = self.create_integration_external_issue(
            group=group_1,
            integration=integration_github,
            key="APP-123-GH",
            title="github for group 1",
            description="this is an example description",
        )
        external_issue_1b = self.create_integration_external_issue(
            group=group_1,
            integration=integration_jira,
            key="APP-123-JIRA",
            title="jira for group 1",
            description="this is an example description",
        )

        # integrations and external issues for group 2
        group_2 = self.create_group()
        external_issue_2a = self.create_integration_external_issue(
            group=group_2,
            integration=integration_github,
            key="APP-456-GH",
            title="github for group 2",
            description="this is an example description",
        )
        external_issue_2b = self.create_integration_external_issue(
            group=group_2,
            integration=integration_jira,
            key="APP-456-JIRA",
            title="jira for group 2",
            description="this is an example description",
        )
        external_issue_2c = self.create_integration_external_issue(
            group=group_2,
            integration=integration_jira,
            key="APP-789-GH",
            title="another jira for group 2",
            description="this is an example description",
        )

        # test serializer on group 1
        group_1_issues = serialize(
            [external_issue_1a, external_issue_1b],
            serializer=ExternalIssueSerializer(),
        )

        # group 1 should have 2 issues
        assert len(group_1_issues) == 2
        assert group_1_issues[0].get("key") == external_issue_1a.key
        assert group_1_issues[1].get("key") == external_issue_1b.key
        assert group_1_issues[0].get("title") == external_issue_1a.title
        assert group_1_issues[1].get("title") == external_issue_1b.title
        assert group_1_issues[0].get("description") == external_issue_1a.description
        assert group_1_issues[1].get("description") == external_issue_1b.description
        assert group_1_issues[0].get("integrationKey") == integration_github.provider
        assert group_1_issues[1].get("integrationKey") == integration_jira.provider
        assert group_1_issues[0].get("integrationName") == integration_github.name
        assert group_1_issues[1].get("integrationName") == integration_jira.name

        # test serializer on group 2
        group_2_issues = serialize(
            [external_issue_2a, external_issue_2b, external_issue_2c],
            serializer=ExternalIssueSerializer(),
        )

        # group 2 should have 3 issues
        assert len(group_2_issues) == 3
        assert group_2_issues[0].get("key") == external_issue_2a.key
        assert group_2_issues[1].get("key") == external_issue_2b.key
        assert group_2_issues[2].get("key") == external_issue_2c.key
        assert group_2_issues[0].get("title") == external_issue_2a.title
        assert group_2_issues[1].get("title") == external_issue_2b.title
        assert group_2_issues[0].get("description") == external_issue_2a.description
        assert group_2_issues[2].get("description") == external_issue_2c.description
        assert group_2_issues[0].get("integrationKey") == integration_github.provider
        assert group_2_issues[2].get("integrationKey") == integration_jira.provider
        assert group_2_issues[0].get("integrationName") == integration_github.name
        assert group_2_issues[1].get("integrationName") == integration_jira.name
