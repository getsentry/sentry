from fixtures.integrations.jira.stub_client import StubJiraApiClient
from sentry.integrations.jira.models.create_issue_metadata import JiraIssueTypeMetadata
from sentry.testutils.cases import TestCase


class TestJiraSchema(TestCase):
    def test_schema_parsing(self):
        create_meta = StubJiraApiClient().get_create_meta_for_project("proj-1")
        issue_configs = list(JiraIssueTypeMetadata.from_jira_meta_config(create_meta).values())
        assert len(issue_configs) == 1
        assert issue_configs[0].name == "Bug"
        assert issue_configs[0].id == "1"
        assert len(issue_configs[0].fields) > 1
