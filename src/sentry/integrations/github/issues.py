from __future__ import absolute_import

from django.core.urlresolvers import reverse
from sentry.integrations.exceptions import ApiError, IntegrationError
from sentry.integrations.issues import IssueBasicMixin
from sentry.utils.http import absolute_uri


class GitHubIssueBasic(IssueBasicMixin):
    def make_external_key(self, data):
        return '{}#{}'.format(data['repo'], data['key'])

    def get_issue_url(self, key):
        domain_name, user = self.model.metadata['domain_name'].split('/')
        repo, issue_id = key.split('#')
        return "https://{}/{}/issues/{}".format(domain_name, repo, issue_id)

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
                    data={
                        'body': comment,
                    },
                )
            except ApiError as e:
                raise IntegrationError(self.message_from_error(e))

    def get_create_issue_config(self, group, **kwargs):
        fields = super(GitHubIssueBasic, self).get_create_issue_config(group, **kwargs)
        try:
            repos = self.get_repositories()
        except ApiError:
            repo_choices = [(' ', ' ')]
        else:
            repo_choices = [(repo['identifier'], repo['name']) for repo in repos]

        params = kwargs.get('params', {})
        default_repo = params.get('repo', repo_choices[0][0])
        assignees = self.get_allowed_assignees(default_repo)

        org = group.organization
        autocomplete_url = reverse(
            'sentry-extensions-github-search', args=[org.slug, self.model.id],
        )

        return [
            {
                'name': 'repo',
                'label': 'GitHub Repository',
                'type': 'select',
                'default': default_repo,
                'defaultLabel': default_repo.split('/')[1],
                'url': autocomplete_url,
                'updatesForm': True,
                'required': True,
            }
        ] + fields + [
            {
                'name': 'assignee',
                'label': 'Assignee',
                'default': '',
                'type': 'select',
                'required': False,
                'choices': assignees,
            }
        ]

    def create_issue(self, data, **kwargs):
        client = self.get_client()

        repo = data.get('repo')

        if not repo:
            raise IntegrationError('repo kwarg must be provided')

        try:
            issue = client.create_issue(
                repo=repo,
                data={
                    'title': data['title'],
                    'body': data['description'],
                    'assignee': data.get('assignee'),
                })
        except ApiError as e:
            raise IntegrationError(self.message_from_error(e))

        return {
            'key': issue['number'],
            'title': issue['title'],
            'description': issue['body'],
            'url': issue['html_url'],
            'repo': repo,
        }

    def get_link_issue_config(self, group, **kwargs):
        try:
            repos = self.get_repositories()
        except ApiError:
            repo_choices = [(' ', ' ')]
        else:
            repo_choices = [(repo['identifier'], repo['name']) for repo in repos]

        params = kwargs.get('params', {})
        default_repo = params.get('repo', repo_choices[0][0])

        org = group.organization
        autocomplete_url = reverse(
            'sentry-extensions-github-search', args=[org.slug, self.model.id],
        )

        return [
            {
                'name': 'repo',
                'label': 'GitHub Repository',
                'type': 'select',
                'default': default_repo,
                'defaultLabel': default_repo.split('/')[1],
                'url': autocomplete_url,
                'required': True,
                'updatesForm': True,
            },
            {
                'name': 'externalIssue',
                'label': 'Issue',
                'default': '',
                'type': 'select',
                'url': autocomplete_url,
                'required': True,
            },
            {
                'name': 'comment',
                'label': 'Comment',
                'default': u'Sentry issue: [{issue_id}]({url})'.format(
                    url=absolute_uri(group.get_absolute_url()),
                    issue_id=group.qualified_short_id,
                ),
                'type': 'textarea',
                'required': False,
                'help': ('Leave blank if you don\'t want to '
                         'add a comment to the GitHub issue.'),
            }
        ]

    def get_issue(self, issue_id, **kwargs):
        data = kwargs['data']
        repo = data.get('repo')
        issue_num = data.get('externalIssue')
        client = self.get_client()

        if not repo:
            raise IntegrationError('repo must be provided')

        if not issue_num:
            raise IntegrationError('issue must be provided')

        try:
            issue = client.get_issue(repo, issue_num)
        except ApiError as e:
            raise IntegrationError(self.message_from_error(e))

        return {
            'key': issue['number'],
            'title': issue['title'],
            'description': issue['body'],
            'url': issue['html_url'],
            'repo': repo,
        }

    def get_allowed_assignees(self, repo):
        client = self.get_client()
        try:
            response = client.get_assignees(repo)
        except Exception as e:
            self.raise_error(e)

        users = tuple((u['login'], u['login']) for u in response)

        return (('', 'Unassigned'), ) + users

    def get_repo_issues(self, repo):
        client = self.get_client()
        try:
            response = client.get_issues(repo)
        except Exception as e:
            self.raise_error(e)

        issues = tuple((i['number'], '#{} {}'.format(i['number'], i['title'])) for i in response)

        return issues
