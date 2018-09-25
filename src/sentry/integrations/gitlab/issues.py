from __future__ import absolute_import

import re

from django.core.urlresolvers import reverse
from sentry.integrations.exceptions import ApiError, IntegrationError
from sentry.integrations.issues import IssueBasicMixin


class GitlabIssueBasic(IssueBasicMixin):
    def make_external_key(self, data):
        return u'{}:{}#{}'.format(self.model.metadata['domain_name'], data['project'], data['key'])

    def get_issue_url(self, key):
        match = re.match(r'.+:(.+)#(.+)', key)
        project, issue_id = match.group(1), match.group(2)
        return u'{}/{}/issues/{}'.format(
            self.model.metadata['base_url'],
            project,
            issue_id,
        )

    def after_link_issue(self, external_issue, **kwargs):
        # data = kwargs['data']
        # client = self.get_client()

        # project, issue_num = external_issue.key.split('#')
        # if not project:
        #     raise IntegrationError('project must be provided')

        # if not issue_num:
        #     raise IntegrationError('issue number must be provided')

        # comment = data.get('comment')
        # if comment:
        #     try:
        #         client.create_comment(
        #             project=project,
        #             issue_id=issue_num,
        #             data={
        #                 'body': comment,
        #             },
        #         )
        #     except ApiError as e:
        #         raise IntegrationError(self.message_from_error(e))
        pass

    def get_create_issue_config(self, group, **kwargs):
        fields = super(GitlabIssueBasic, self).get_create_issue_config(group, **kwargs)
        try:
            projects = self.get_projects()
        except ApiError:
            project_choices = [(' ', ' ')]
        else:
            project_choices = [(project['identifier'], project['name']) for project in projects]

        params = kwargs.get('params', {})
        default_project = params.get('project', project_choices[0][0])

        org = group.organization
        autocomplete_url = reverse(
            'sentry-extensions-gitlab-search', args=[org.slug, self.model.id],
        )

        return [
            {
                'name': 'project',
                'label': 'Gitlab Project',
                'type': 'select',
                'default': default_project,
                'defaultLabel': default_project,
                'url': autocomplete_url,
                'updatesForm': True,
                'required': True,
            }
        ] + fields

    def create_issue(self, data, **kwargs):
        client = self.get_client()

        project = data.get('project')

        if not project:
            raise IntegrationError('project kwarg must be provided')

        try:
            issue = client.create_issue(
                project=project,
                data={
                    'title': data['title'],
                    'body': data['description'],
                })
        except ApiError as e:
            raise IntegrationError(self.message_from_error(e))

        return {
            'key': issue['number'],
            'title': issue['title'],
            'description': issue['body'],
            'url': issue['html_url'],
            'project': project,
        }

    def get_link_issue_config(self, group, **kwargs):
        try:
            projects = self.get_projects()
        except ApiError:
            project_choices = [(' ', ' ')]
        else:
            project_choices = [(project['identifier'], project['name']) for project in projects]

        params = kwargs.get('params', {})
        default_project = params.get('project', project_choices[0][0])

        org = group.organization
        autocomplete_url = reverse(
            'sentry-extensions-gitlab-search', args=[org.slug, self.model.id],
        )

        return [
            {
                'name': 'project',
                'label': 'Gitlab Project',
                'type': 'select',
                'default': default_project,
                'defaultLabel': default_project,
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
        ]

    def get_issue(self, issue_id, **kwargs):
        data = kwargs['data']
        project = data.get('project')
        issue_num = data.get('externalIssue')
        client = self.get_client()

        if not project:
            raise IntegrationError('project must be provided')

        if not issue_num:
            raise IntegrationError('issue must be provided')

        try:
            issue = client.get_issue(project, issue_num)
        except ApiError as e:
            raise IntegrationError(self.message_from_error(e))

        return {
            'key': issue['number'],
            'title': issue['title'],
            'description': issue['body'],
            'url': issue['html_url'],
            'project': project,
        }

    def get_allowed_assignees(self, project):
        client = self.get_client()
        try:
            response = client.get_assignees(project)
        except Exception as e:
            self.raise_error(e)

        users = tuple((u['login'], u['login']) for u in response)

        return (('', 'Unassigned'), ) + users

    def get_project_issues(self, project):
        client = self.get_client()
        try:
            response = client.get_issues(project)
        except Exception as e:
            self.raise_error(e)

        issues = tuple((i['number'], u'#{} {}'.format(i['number'], i['title'])) for i in response)

        return issues
