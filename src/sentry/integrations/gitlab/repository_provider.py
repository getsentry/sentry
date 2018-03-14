from sentry.plugins.providers.repository import RepositoryProvider


class GitLabRepositoryProvider(RepositoryProvider):
    def get_config(self):
        return [
            {
                'name': 'name',
                'label': 'Repository Name',
                'type': 'text',
                'placeholder': 'e.g. getsentry/sentry',
                'help': 'Enter your repository name, including the owner.',
                'required': True,
            }
        ]

    def create_repository(self, organization, data, actor=None):
        pass

    def compare_commits(self, repo, start_sha, end_sha, actor=None):
        pass