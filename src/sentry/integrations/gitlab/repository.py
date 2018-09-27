from __future__ import absolute_import

import six

from sentry.plugins import providers
from sentry.models import Integration

MAX_COMMIT_DATA_REQUESTS = 90


class GitlabRepositoryProvider(providers.IntegrationRepositoryProvider):
    name = 'Gitlab'

    def get_installation(self, integration_id, organization_id):
        if integration_id is None:
            raise ValueError('%s requires an integration_id' % self.name)

        try:
            integration_model = Integration.objects.get(id=integration_id)
        except Integration.DoesNotExist as error:
            self.handle_api_error(error)

        return integration_model.get_installation(organization_id)

    def validate_config(self, organization, config):
        installation = self.get_installation(config['installation'], organization.id)
        client = installation.get_client()

        repo_id = config['identifier']
        instance = installation.model.metadata['domain_name']

        try:
            repo = client.get_project(six.text_type(repo_id))
        except Exception as e:
            installation.raise_error(e)
        config.update({
            'instance': instance,
            'path': repo['path_with_namespace'],
            'name': repo['name_with_namespace'],
            'repo_id': repo['id'],
            'external_id': '%s:%s' % (instance, repo['path']),
            'url': repo['web_url'],
        })
        return config

    def create_repository(self, organization, data):
        return {
            'name': data['name'],
            'external_id': data['external_id'],
            'url': data['url'],
            'config': {
                'instance': data['instance'],
                'repo_id': data['repo_id'],
                'path': data['path']
            },
            'integration_id': data['installation'],
        }

    def transform_changes(self, patch_set):
        type_mapping = {
            'add': 'A',
            'delete': 'D',
            'edit': 'M',
        }
        file_changes = []
        # https://docs.microsoft.com/en-us/rest/api/vsts/git/commits/get%20changes#versioncontrolchangetype
        for change in patch_set:
            change_type = type_mapping.get(change['changeType'])

            if change_type and change.get('item') and change['item']['gitObjectType'] == 'blob':
                file_changes.append({
                    'path': change['item']['path'],
                    'type': change_type
                })

        return file_changes

    def zip_commit_data(self, repo, commit_list, organization_id):
        installation = self.get_installation(repo.integration_id, organization_id)
        client = installation.get_client()
        n = 0
        for commit in commit_list:
            commit.update(
                {'patch_set': self.transform_changes(
                    client.get_commit_filechanges(
                        repo.config['instance'], repo.external_id, commit['commitId'])
                )})

            n += 1
            if n > MAX_COMMIT_DATA_REQUESTS:
                break

        return commit_list

    def compare_commits(self, repo, start_sha, end_sha):
        installation = self.get_installation(repo.integration_id, repo.organization_id)
        client = installation.get_client()
        instance = repo.config['instance']

        try:
            if start_sha is None:
                res = client.get_commits(instance, repo.external_id, commit=end_sha, limit=10)
            else:
                res = client.get_commit_range(instance, repo.external_id, start_sha, end_sha)
        except Exception as e:
            installation.raise_error(e)

        commits = self.zip_commit_data(repo, res['value'], repo.organization_id)
        return self._format_commits(repo, commits)

    def _format_commits(self, repo, commit_list):
        return [
            {
                'id': c['commitId'],
                'repository': repo.name,
                'author_email': c['author']['email'],
                'author_name': c['author']['name'],
                'message': c['comment'],
                'patch_set': c.get('patch_set'),
            } for c in commit_list
        ]
