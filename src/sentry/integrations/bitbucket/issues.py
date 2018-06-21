from __future__ import absolute_import
from sentry.integrations.issues import IssueSyncMixin
from sentry.integrations.exceptions import ApiError


ISSUE_TYPES = (
    ('bug', 'Bug'), ('enhancement', 'Enhancement'), ('proposal', 'Proposal'), ('task', 'Task'),
)

PRIORITIES = (
    ('trivial', 'Trivial', ), ('minor', 'Minor', ), ('major', 'Major'), ('critical', 'Critical'),
    ('blocker', 'Blocker'),
)

ERR_404 = (
    'Bitbucket returned a 404. Please make sure that '
    'the repo exists, you have access to it, and it has '
    'issue tracking enabled.'
)


class BitbucketIssueSyncMixin(IssueSyncMixin):

    def get_create_issue_config(self, group, **kwargs):
        fields = super(BitbucketIssueSyncMixin, self).get_create_issue_config(group, **kwargs)
        client = self.get_client()
        try:
            default_repo = self.get_default_repo(group.project_id)
        except Exception:
            default_repo = ('', '')

        try:
            repos = client.get_repos(self.model.name)
        except ApiError:
            repo_choices = []
        else:
            repo_choices = [(repo['uuid'], repo['full_name']) for repo in repos]

        return [
            {
                'name': 'repo',
                'label': 'Bitbucket Repository',
                'default': default_repo,
                'type': 'select',
                'choices': repo_choices,
                'required': True,
            }
        ] + fields + [
            {
                'name': 'issue_type',
                'label': 'Issue type',
                'default': ISSUE_TYPES[0][0],
                'type': 'select',
                'choices': ISSUE_TYPES
            }, {
                'name': 'priority',
                'label': 'Priority',
                'default': PRIORITIES[0][0],
                'type': 'select',
                'choices': PRIORITIES
            }
        ]

    def create_issue(self, data, **kwargs):
        client = self.get_client()
        repo = self.get_repo(
            repo=kwargs.get('repo'),
            project_id=kwargs.get('project_id'),
        )
        issue = client.create_issue(repo, data)
        return {
            'key': issue['id'],
            'title': issue['title'],
            'description': issue['content']['html'],  # users content rendered as html
        }

    def get_issue(self, issue_id, **kwargs):
        client = self.get_client()
        repo = self.get_repo(
            repo=kwargs.get('repo'),
            project_id=kwargs.get('project_id')
        )
        issue = client.get_issue(repo, issue_id)
        return {
            'key': issue['id'],
            'title': issue['title'],
            'description': issue['content']['html'],  # users content rendered as html
        }

    def message_from_error(self, exc):
        if isinstance(exc, ApiError) and exc.code == 404:
            return ERR_404
        return super(BitbucketIssueSyncMixin, self).message_from_error(exc)
