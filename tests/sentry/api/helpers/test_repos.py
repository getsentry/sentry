from sentry.api.helpers.repos import get_repos_from_project_code_mappings
from sentry.testutils.cases import TestCase


class TestGetRepoFromCodeMappings(TestCase):
    def test_get_repos_from_project_code_mappings_empty(self):
        project = self.create_project()
        repos = get_repos_from_project_code_mappings(project)
        self.assertEqual(repos, [])

    def test_get_repos_from_project_code_mappings_with_data(self):
        project = self.create_project()
        repo = self.create_repo(name="getsentry/sentry", provider="github", external_id="123")
        self.create_code_mapping(project=project, repo=repo)
        repos = get_repos_from_project_code_mappings(project)
        expected_repos = [
            {
                "provider": repo.provider,
                "owner": "getsentry",
                "name": "sentry",
                "external_id": "123",
            }
        ]
        self.assertEqual(repos, expected_repos)
