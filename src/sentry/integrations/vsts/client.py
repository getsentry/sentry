from __future__ import absolute_import

from sentry.integrations.client import ApiClient

UNSET = object()

FIELD_MAP = {
    'title': '/fields/System.Title',
    'description': '/fields/System.Description',
    'comment': '/fields/System.History',
    'link': '/relations/-',
}


class VstsApiPath(object):
    commits = 'https://{account_name}/DefaultCollection/_apis/git/repositories/{repo_id}/commits'
    commits_batch = 'https://{account_name}/DefaultCollection/_apis/git/repositories/{repo_id}/commitsBatch'
    commits_changes = 'https://{account_name}/DefaultCollection/_apis/git/repositories/{repo_id}/commits/{commit_id}/changes'
    projects = 'https://{account_name}/DefaultCollection/_apis/projects'
    repositories = 'https://{account_name}/DefaultCollection/{project}_apis/git/repositories/{repo_id}'
    work_items = 'https://{account_name}/DefaultCollection/_apis/wit/workitems/{id}'
    work_items_create = 'https://{account_name}/{project}/_apis/wit/workitems/${type}'


class VstsApiClient(ApiClient):
    api_version = '4.1'

    def __init__(self, access_token, *args, **kwargs):
        super(VstsApiClient, self).__init__(*args, **kwargs)
        self.access_token = access_token

    def request(self, method, path, data=None, params=None):
        headers = {
            'Accept': 'application/json; api-version={}'.format(self.api_version),
            'Content-Type': 'application/json-patch+json' if method == 'PATCH' else 'application/json',
            'X-HTTP-Method-Override': method,
            'X-TFS-FedAuthRedirect': 'Suppress',
            'Authorization': 'Bearer {}'.format(self.access_token)
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
                         comment=UNSET):
        data = []

        for f_name, f_value in (('title', title), ('description', description), ('link', link)):
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

    def get_repo(self, instance, name_or_id, project=None):
        return self.get(
            VstsApiPath.repositories.format(
                account_name=instance,
                project='{}/'.format(project) if project else '',
                repo_id=name_or_id,
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
