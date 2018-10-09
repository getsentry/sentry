from __future__ import absolute_import

import re

from django.core.urlresolvers import reverse
from sentry.integrations.exceptions import ApiError, IntegrationError
from sentry.integrations.issues import IssueBasicMixin

ISSUE_EXTERNAL_KEY_FORMAT = re.compile(r'.+:(.+)#(.+)')


class GitlabIssueBasic(IssueBasicMixin):
    def make_external_key(self, data):
        return u'{}:{}'.format(self.model.metadata['domain_name'], data['key'])

    def get_issue_url(self, key):
        match = ISSUE_EXTERNAL_KEY_FORMAT.match(key)
        project, issue_id = match.group(1), match.group(2)
        return u'{}/{}/issues/{}'.format(
            self.model.metadata['base_url'],
            project,
            issue_id,
        )

    def get_create_issue_config(self, group, **kwargs):
        fields = super(GitlabIssueBasic, self).get_create_issue_config(group, **kwargs)
        # TODO(lb): Add Default Project Functionality when avaliable

        org = group.organization
        autocomplete_url = reverse(
            'sentry-extensions-gitlab-search', args=[org.slug, self.model.id],
        )

        return [
            {
                'name': 'project',
                'label': 'Gitlab Project',
                'type': 'select',
                'url': autocomplete_url,
                'updatesForm': True,
                'required': True,
            }
        ] + fields

    def create_issue(self, data, **kwargs):
        client = self.get_client()

        project_id = data.get('project')

        if not project_id:
            raise IntegrationError('project kwarg must be provided')

        try:
            issue = client.create_issue(
                project=project_id,
                data={
                    'title': data['title'],
                    'description': data['description'],
                })
            project = client.get_project(project_id)
        except ApiError as e:
            raise IntegrationError(self.message_from_error(e))

        project_and_issue_iid = '%s#%s' % (project['path_with_namespace'], issue['iid'])
        return {
            'key': project_and_issue_iid,
            'title': issue['title'],
            'description': issue['description'],
            'url': issue['web_url'],
            'project': project_id,
            'metadata': {
                'display_name': project_and_issue_iid,
            }
        }

    def get_link_issue_config(self, group, **kwargs):
        org = group.organization
        autocomplete_url = reverse(
            'sentry-extensions-gitlab-search', args=[org.slug, self.model.id],
        )

        return [
            {
                'name': 'externalIssue',
                'label': 'Issue',
                'default': '',
                'type': 'select',
                'url': autocomplete_url,
                'required': True,
                'updatesForm': True,
            },
        ]

    def get_issue(self, issue_id, **kwargs):
        project_id, issue_num = issue_id.split('#')
        client = self.get_client()

        if not project_id:
            raise IntegrationError('project must be provided')

        if not issue_num:
            raise IntegrationError('issue must be provided')

        try:
            issue = client.get_issue(project_id, issue_num)
            project = client.get_project(project_id)
        except ApiError as e:
            raise IntegrationError(self.message_from_error(e))

        project_and_issue_iid = '%s#%s' % (project['path_with_namespace'], issue['iid'])
        return {
            'key': project_and_issue_iid,
            'title': issue['title'],
            'description': issue['description'],
            'url': issue['web_url'],
            'project': project_id,
            'metadata': {
                'display_name': project_and_issue_iid,
            }
        }

    def get_issue_display_name(self, external_issue):
        return external_issue.metadata['display_name']
