from __future__ import absolute_import

import six

from sentry.plugins import providers
from sentry.models import Integration

MAX_COMMIT_DATA_REQUESTS = 90


class VstsRepositoryProvider(providers.IntegrationRepositoryProvider):
    name = 'Visual Studio Team Services v2'

    def get_installation(self, integration_id, organization_id):
        if integration_id is None:
            raise ValueError('%s requires an integration_id' % self.name)

        try:
            integration_model = Integration.objects.get(id=integration_id)
        except Integration.DoesNotExist as error:
            self.handle_api_error(error)

        return integration_model.get_installation(organization_id)

    def get_config(self, organization):
        choices = []
        for i in Integration.objects.filter(organizations=organization, provider='vsts'):
            choices.append((i.id, i.name))

        if not choices:
            choices = [('', '')]
        return [
            {
                'name': 'integration_id',
                'label': 'Visual Studio Installation',
                'type': 'choice',
                'choices': choices,
                'initial': choices[0][0],
                'help': 'Select which %s integration to authenticate with.' % self.name,
                'required': True,
            },
            {
                'name': 'url',
                'label': 'Repository URL',
                'type': 'text',
                'placeholder': 'e.g. https://example.visualstudio.com/_git/MyFirstProject',
                'required': True,
            },
            {
                'name': 'project',
                'label': 'Project Name',
                'type': 'text',
                'placeholder': 'e.g. MyFirstProject',
                'help': 'Optional project name if it does not match the repository name',
                'required': False,
            }
        ]

    def validate_config(self, organization, config):
        if config.get('url'):
            installation = self.get_installation(config['integration_id'], organization.id)
            client = installation.get_client()
            instance = installation.instance

            name = config['name']
            project = config['project']

            try:
                repo = client.get_repo(instance, name, project)
            except Exception as e:
                installation.raise_error(e)
            config.update({
                'instance': instance,
                'project': project,
                'name': repo['name'],
                'external_id': six.text_type(repo['id']),
                'url': repo['_links']['web']['href'],
            })
            return config

    def create_repository(self, organization, data):
        return {
            'name': data['name'],
            'external_id': data['external_id'],
            'url': data['url'],
            'config': {
                'instance': data['instance'],
                'project': data['project'],
                'name': data['name'],
            },
            'integration_id': data['integration_id'],
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
