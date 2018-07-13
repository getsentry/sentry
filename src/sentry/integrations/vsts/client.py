from __future__ import absolute_import

from sentry.integrations.client import ApiClient, OAuth2RefreshMixin
from sentry.utils.http import absolute_uri

UNSET = object()

FIELD_MAP = {
    'title': '/fields/System.Title',
    'description': '/fields/System.Description',
    'comment': '/fields/System.History',
    'link': '/relations/-',
    'assigned_to': '/fields/System.AssignedTo',
    'state': '/fields/System.State',
}
INVALID_ACCESS_TOKEN = 'HTTP 400 (invalid_request): The access token is not valid'


class VstsApiPath(object):
    commits = u'https://{account_name}/DefaultCollection/_apis/git/repositories/{repo_id}/commits'
    commits_batch = u'https://{account_name}/DefaultCollection/_apis/git/repositories/{repo_id}/commitsBatch'
    commits_changes = u'https://{account_name}/DefaultCollection/_apis/git/repositories/{repo_id}/commits/{commit_id}/changes'
    delete = 'https://{account_name}/_apis/hooks/subscriptions/{subscription_id}'
    projects = u'https://{account_name}/DefaultCollection/_apis/projects'
    repository = u'https://{account_name}/DefaultCollection/{project}_apis/git/repositories/{repo_id}'
    repositories = u'https://{accountName}.visualstudio.com/{project}/_apis/git/repositories'
    subscriptions = u'https://{account_name}/_apis/hooks/subscriptions'
    work_items = u'https://{account_name}/DefaultCollection/_apis/wit/workitems/{id}'
    work_items_create = u'https://{account_name}/{project}/_apis/wit/workitems/${type}'
    work_items_types_states = u'https://{account_name}/{project}/_apis/wit/workitemtypes/{type}/states'
    users = u'https://{account_name}.vssps.visualstudio.com/_apis/graph/users'


class VstsApiClient(ApiClient, OAuth2RefreshMixin):
    api_version = '4.1'
    api_version_preview = '-preview.1'

    def __init__(self, identity, oauth_redirect_url, *args, **kwargs):
        super(VstsApiClient, self).__init__(*args, **kwargs)
        self.identity = identity
        self.oauth_redirect_url = oauth_redirect_url
        if 'access_token' not in self.identity.data:
            raise ValueError('Vsts Identity missing access token')

    def request(self, method, path, data=None, params=None, api_preview=False):
        self.check_auth(redirect_url=self.oauth_redirect_url)
        headers = {
            'Accept': 'application/json; api-version={}{}'.format(self.api_version, self.api_version_preview if api_preview else ''),
            'Content-Type': 'application/json-patch+json' if method == 'PATCH' else 'application/json',
            'X-HTTP-Method-Override': method,
            'X-TFS-FedAuthRedirect': 'Suppress',
            'Authorization': 'Bearer {}'.format(self.identity.data['access_token'])
        }
        return self._request(method, path, headers=headers, data=data, params=params)

    def create_work_item(self, instance, project, title=None,
                         description=None, comment=None, link=None):
        data = []
        if title:
            data.append({
                'op': 'add',
                'path': FIELD_MAP['title'],
                'value': title,
            })
        if description:
            data.append({
                'op': 'add',
                'path': FIELD_MAP['description'],
                'value': description
            })
        if comment:
            data.append({
                'op': 'add',
                'path': FIELD_MAP['comment'],
                'value': comment,
            })
        # XXX: Link is not yet used, as we can't explicitly bind it to Sentry.
        # if link:
        #     data.append({
        #         'op': 'add',
        #         'path': FIELD_MAP['link'],
        #         'value': {
        #             'rel': 'Hyperlink',
        #             'url': link,
        #         }
        #     })

        return self.patch(
            VstsApiPath.work_items_create.format(
                account_name=instance,
                project=project,
                type='Bug'
            ),
            data=data,
        )

    def update_work_item(self, instance, id, title=UNSET, description=UNSET, link=UNSET,
                         comment=UNSET, assigned_to=UNSET, state=UNSET):
        data = []

        for f_name, f_value in (('title', title), ('description', description),
                                ('link', link), ('assigned_to', assigned_to), ('state', state)):
            if f_name == 'link':
                # XXX: Link is not yet used, as we can't explicitly bind it to Sentry.
                continue
            elif f_value is None:
                data.append({
                    'op': 'remove',
                    'path': FIELD_MAP[f_name],
                })
            elif f_value is not UNSET:
                data.append({
                    # TODO(dcramer): this is problematic when the link already exists
                    'op': 'replace' if f_name != 'link' else 'add',
                    'path': FIELD_MAP[f_name],
                    'value': {
                        'rel': 'Hyperlink',
                        'url': f_value,
                    } if f_name == 'link' else f_value,
                })

        if comment is not UNSET and comment:
            data.append({
                'op': 'add',
                'path': FIELD_MAP['comment'],
                'value': comment,
            })

        return self.patch(
            VstsApiPath.work_items.format(
                account_name=instance,
                id=id,
            ),
            data=data,
        )

    def get_work_item(self, instance, id):
        return self.get(
            VstsApiPath.work_items.format(
                account_name=instance,
                id=id,
            ),
        )

    def get_work_item_states(self, instance, project=None):
        if project is None:
            # TODO(lb): I'm pulling from the first project.
            # Not sure what else to do here unless I can prompt the user
            project = self.get_projects(instance)['value'][0]['id']
        return self.get(
            VstsApiPath.work_items_types_states.format(
                account_name=instance,
                project=project,
                # TODO(lb): might want to make this custom like jira at some point
                type='Bug',
            ),
            api_preview=True,
        )

    def get_work_item_types(self, instance, process_id):
        return self.get(
            VstsApiPath.work_item_types.format(
                account_name=instance,
                process_id=process_id,
            ),
            api_preview=True,
        )

    def get_repo(self, instance, name_or_id, project=None):
        return self.get(
            VstsApiPath.repository.format(
                account_name=instance,
                project='{}/'.format(project) if project else '',
                repo_id=name_or_id,
            ),
        )

    def get_repos(self, instance, project=None):
        return self.get(
            VstsApiPath.repositories.format(
                account_name=instance,
                project='{}/'.format(project) if project else '',
            ),
        )

    def get_commits(self, instance, repo_id, commit, limit=100):
        return self.get(
            VstsApiPath.commits.format(
                account_name=instance,
                repo_id=repo_id,
            ),
            params={
                'commit': commit,
                '$top': limit,
            },
        )

    def get_commit_filechanges(self, instance, repo_id, commit):

        resp = self.get(
            VstsApiPath.commits_changes.format(
                account_name=instance,
                repo_id=repo_id,
                commit_id=commit,
            )
        )
        changes = resp['changes']
        return changes

    def get_commit_range(self, instance, repo_id, start_sha, end_sha):
        return self.post(
            VstsApiPath.commits_batch.format(
                account_name=instance,
                repo_id=repo_id,
            ),
            data={
                'itemVersion': {
                    'versionType': 'commit',
                    'version': start_sha,
                },
                'compareVersion': {
                    'versionType': 'commit',
                    'version': end_sha
                }
            }
        )

    def get_projects(self, instance):
        # TODO(dcramer): VSTS doesn't provide a way to search, so we're
        # making the assumption that a user has 100 or less projects today.
        return self.get(
            VstsApiPath.projects.format(
                account_name=instance,
            ),
            params={'stateFilter': 'WellFormed'}
        )

    def get_users(self, account_name):
        return self.get(
            VstsApiPath.users.format(
                account_name=account_name,
            ),
            api_preview=True,
        )

    def create_subscription(self, instance, external_id, shared_secret):
        return self.post(
            VstsApiPath.subscriptions.format(
                account_name=instance
            ),
            data={
                'publisherId': 'tfs',
                'eventType': 'workitem.updated',
                'resourceVersion': '1.0',
                'consumerId': 'webHooks',
                'consumerActionId': 'httpRequest',
                'consumerInputs': {
                    'url': absolute_uri('/extensions/vsts/issue-updated/'),
                    'resourceDetailsToSend': 'all',
                    'httpHeaders': 'shared-secret:%s' % shared_secret,
                }
            },
        )

    def delete_subscription(self, instance, subscription_id):
        self.delete(
            VstsApiPath.delete_url.format(
                account_name=instance,
                subscription_id=subscription_id,
            )
        )
