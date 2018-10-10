from __future__ import absolute_import
from django.core.urlresolvers import reverse
from sentry.integrations.issues import IssueBasicMixin
from sentry.integrations.exceptions import ApiError, IntegrationFormError


ISSUE_TYPES = (
    ('bug', 'Bug'), ('enhancement', 'Enhancement'), ('proposal', 'Proposal'), ('task', 'Task'),
)

PRIORITIES = (
    ('trivial', 'Trivial', ), ('minor', 'Minor', ), ('major', 'Major'), ('critical', 'Critical'),
    ('blocker', 'Blocker'),
)


class BitbucketIssueBasicMixin(IssueBasicMixin):

    def get_issue_url(self, key):
        repo, issue_id = key.split('#')
        return u'https://bitbucket.org/{}/issues/{}'.format(repo, issue_id)

    def get_persisted_default_config_fields(self):
        return ['repo']

    def get_repo_choices(self, group, **kwargs):
        try:
            repos = self.get_repositories()
        except ApiError:
            return [], None

        repo_choices = [(repo['identifier'], repo['name']) for repo in repos]
        default_repo = self.get_project_defaults(group.project_id).get('repo')
        params = kwargs.get('params', {})
        try:
            default_repo = params.get('repo', default_repo or repo_choices[0][0])
        except IndexError:
            return repo_choices, None

        return repo_choices, default_repo

    def get_create_issue_config(self, group, **kwargs):
        fields = super(BitbucketIssueBasicMixin, self).get_create_issue_config(group, **kwargs)
        repo_choices, default_repo = self.get_repo_choices(group, **kwargs)

        org = group.organization
        autocomplete_url = reverse(
            'sentry-extensions-bitbucket-search', args=[org.slug, self.model.id],
        )

        return [
            {
                'name': 'repo',
                'required': True,
                'type': 'select',
                'url': autocomplete_url,
                'choices': repo_choices,
                'defaultValue': default_repo,
                'label': 'Bitbucket Repository',
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
        repo_choices, default_repo = self.get_repo_choices(group, **kwargs)

        org = group.organization
        autocomplete_url = reverse(
            'sentry-extensions-bitbucket-search', args=[org.slug, self.model.id],
        )

        return [{
            'name': 'repo',
            'required': True,
            'type': 'select',
            'url': autocomplete_url,
            'choices': repo_choices,
            'defaultValue': default_repo,
            'label': 'Bitbucket Repository',
        }, {
            'name': 'externalIssue',
            'label': 'Issue',
            'default': '',
            'type': 'select',
            'required': True,
            'url': autocomplete_url,
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
        if not data.get('repo'):
            raise IntegrationFormError({'repo': ['Repository is required']})

        try:
            issue = client.create_issue(data.get('repo'), data)
        except ApiError as e:
            self.raise_error(e)

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

    def make_external_key(self, data):
        return u'{}#{}'.format(data['repo'], data['key'])

    def after_link_issue(self, external_issue, **kwargs):
        data = kwargs['data']
        client = self.get_client()

        repo, issue_num = external_issue.key.split('#')

        if not repo:
            raise IntegrationFormError({'repo': 'Repository is required'})
        if not issue_num:
            raise IntegrationFormError({'externalIssue': 'Issue ID is required'})

        comment = data.get('comment')
        if comment:
            try:
                client.create_comment(
                    repo=repo,
                    issue_id=issue_num,
                    data={'content': {'raw': comment}}
                )
            except ApiError as e:
                self.raise_error(e)
