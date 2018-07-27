from __future__ import absolute_import
from sentry.integrations.issues import IssueBasicMixin
from sentry.integrations.exceptions import ApiError, IntegrationError


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


class BitbucketIssueBasicMixin(IssueBasicMixin):

    def get_issue_url(self, key):
        repo, issue_id = key.split('#')
        return 'https://bitbucket.org/{}/issues/{}'.format(repo, issue_id)

    def get_repo_choices(self, **kwargs):
        client = self.get_client()

        try:
            repos = client.get_repos(self.username)
        except ApiError:
            repo_choices = []
        else:
            repo_choices = [(repo['full_name'], repo['full_name']) for repo in repos['values']]

        params = kwargs.get('params', {})
        default_repo = params.get('repo', repo_choices[0][0])
        issues = self.get_repo_issues(default_repo)
        return repo_choices, default_repo, issues

    def get_create_issue_config(self, group, **kwargs):
        fields = super(BitbucketIssueBasicMixin, self).get_create_issue_config(group, **kwargs)
        repo_choices, default_repo, issues = self.get_repo_choices(**kwargs)
        return [
            {
                'name': 'repo',
                'label': 'Bitbucket Repository',
                'type': 'select',
                'default': default_repo,
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

    def get_link_issue_config(self, group, **kwargs):
        repo_choices, default_repo, issues = self.get_repo_choices(**kwargs)

        return [{
            'name': 'repo',
            'label': 'Bitbucket Repository',
            'type': 'select',
            'default': default_repo,
            'choices': repo_choices,
            'required': True,
            'updatesForm': True,
        }, {
            'name': 'externalIssue',
            'label': 'Issue',
            'default': '',
            'type': 'select',
            'choices': issues,

        }, {
            'name': 'comment',
            'label': 'Comment',
            'default': '',
            'type': 'textarea',
            'required': False,
            'help': ('Leave blank if you don\'t want to '
                     'add a comment to the Bitbucket issue.'),
        }]

    def create_issue(self, data, **kwargs):
        client = self.get_client()
        issue = client.create_issue(data.get('repo'), data)
        return {
            'key': issue['id'],
            'title': issue['title'],
            'description': issue['content']['html'],  # users content rendered as html
            'repo': data.get('repo'),
        }

    def get_issue(self, issue_id, **kwargs):
        client = self.get_client()
        repo = kwargs['data'].get('repo')
        issue = client.get_issue(repo, issue_id)
        return {
            'key': issue['id'],
            'title': issue['title'],
            'description': issue['content']['html'],  # users content rendered as html
            'repo': repo,
        }

    def message_from_error(self, exc):
        if isinstance(exc, ApiError) and exc.code == 404:
            return ERR_404
        return super(BitbucketIssueBasicMixin, self).message_from_error(exc)

    def get_repo_issues(self, repo):
        client = self.get_client()

        try:
            response = client.get_issues(repo)['values']
        except Exception as e:
            self.raise_error(e)

        issues = tuple((i['id'], '#{} {}'.format(i['id'], i['title'])) for i in response)

        return issues

    def make_external_key(self, data):
        return '{}#{}'.format(data['repo'], data['key'])

    def after_link_issue(self, external_issue, **kwargs):
        data = kwargs['data']
        client = self.get_client()

        repo, issue_num = external_issue.key.split('#')

        if not repo:
            raise IntegrationError('repo must be provided')

        if not issue_num:
            raise IntegrationError('issue number must be provided')

        comment = data.get('comment')
        if comment:
            try:
                client.create_comment(
                    repo=repo,
                    issue_id=issue_num,
                    data={'content': {'raw': comment}}
                )
            except ApiError as e:
                raise IntegrationError(self.message_from_error(e))
