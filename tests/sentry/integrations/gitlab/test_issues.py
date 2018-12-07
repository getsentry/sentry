from __future__ import absolute_import

import responses
import six

from sentry.utils.http import absolute_uri
from .testutils import GitLabTestCase


class GitlabIssuesTest(GitLabTestCase):

    def setUp(self):
        super(GitlabIssuesTest, self).setUp()
        self.group = self.create_group()
        self.create_event(group=self.group)

    def test_make_external_key(self):
        project_name = 'getsentry/sentry'
        issue_iid = '7'
        external_key = '%s#%s' % (project_name, issue_iid)
        domain_name = self.installation.model.metadata['domain_name']
        data = {
            'key': external_key,
        }
        assert self.installation.make_external_key(data) == '%s:%s' % (domain_name, external_key)

    def test_get_issue_url(self):
        issue_id = 'example.gitlab.com:project/project#7'
        assert self.installation.get_issue_url(
            issue_id) == 'https://example.gitlab.com/project/project/issues/7'

    @responses.activate
    def test_get_create_issue_config(self):
        group_description = (
            u'Sentry Issue: [%s](%s)\n\n'
            '```\nStacktrace (most recent call last):\n\n'
            '  File "sentry/models/foo.py", line 29, in build_msg\n'
            '    string_max_length=self.string_max_length)\n\nmessage\n```'
        ) % (
            self.group.qualified_short_id,
            absolute_uri(self.group.get_absolute_url(params={'referrer': 'gitlab_integration'})),
        )
        responses.add(
            responses.GET,
            u'https://example.gitlab.com/api/v4/groups/%s/projects' % self.installation.model.metadata['group_id'],
            json=[
                {'name_with_namespace': 'getsentry / sentry', 'id': 1},
                {'name_with_namespace': 'getsentry / hello', 'id': 22},
            ]
        )
        assert self.installation.get_create_issue_config(self.group) == [
            {
                'url': '/extensions/gitlab/search/baz/%d/' % self.installation.model.id,
                'name': 'project',
                'required': True,
                'type': 'select',
                'label': 'Gitlab Project',
                'choices': [(1, u'getsentry / sentry'), (22, u'getsentry / hello')],
                'defaultValue': 1,
            },
            {
                'name': 'title',
                'label': 'Title',
                'default': self.group.get_latest_event().error(),
                'type': 'string',
                'required': True,
            },
            {
                'name': 'description',
                'label': 'Description',
                'default': group_description,
                'type': 'textarea',
                'autosize': True,
                'maxRows': 10,
            }
        ]

    @responses.activate
    def test_get_link_issue_config(self):
        responses.add(
            responses.GET,
            u'https://example.gitlab.com/api/v4/groups/%s/projects' % self.installation.model.metadata['group_id'],
            json=[
                {'name_with_namespace': 'getsentry / sentry', 'id': 1},
                {'name_with_namespace': 'getsentry / hello', 'id': 22},
            ]
        )
        autocomplete_url = '/extensions/gitlab/search/baz/%d/' % self.installation.model.id
        assert self.installation.get_link_issue_config(self.group) == [
            {
                'name': 'project',
                'label': 'GitLab Project',
                'type': 'select',
                'default': 1,
                'choices': [(1, u'getsentry / sentry'), (22, u'getsentry / hello')],
                'url': autocomplete_url,
                'updatesForm': True,
                'required': True,
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

    @responses.activate
    def test_create_issue(self):
        issue_iid = '1'
        project_id = '10'
        project_name = 'getsentry/sentry'
        key = '%s#%s' % (project_name, issue_iid)
        responses.add(
            responses.POST,
            u'https://example.gitlab.com/api/v4/projects/%s/issues' % project_id,
            json={'id': 8, 'iid': issue_iid, 'title': 'hello', 'description': 'This is the description',
                  'web_url': 'https://example.gitlab.com/%s/issues/%s' % (project_name, issue_iid)}
        )
        responses.add(
            responses.GET,
            u'https://example.gitlab.com/api/v4/projects/%s' % project_id,
            json={'path_with_namespace': project_name, 'id': 10}
        )
        form_data = {
            'project': project_id,
            'title': 'hello',
            'description': 'This is the description',
        }

        assert self.installation.create_issue(form_data) == {
            'key': key,
            'description': 'This is the description',
            'title': 'hello',
            'url': 'https://example.gitlab.com/%s/issues/%s' % (project_name, issue_iid),
            'project': project_id,
            'metadata': {
                'display_name': key,
            }
        }

    @responses.activate
    def test_get_issue(self):
        project_id = '12'
        project_name = 'getsentry/sentry'
        issue_iid = '13'
        key = '%s#%s' % (project_name, issue_iid)
        responses.add(
            responses.GET,
            u'https://example.gitlab.com/api/v4/projects/%s/issues/%s' % (project_id, issue_iid),
            json={'id': 18, 'iid': issue_iid, 'title': 'hello', 'description': 'This is the description',
                  'web_url': 'https://example.gitlab.com/%s/issues/%s' % (project_name, issue_iid)}
        )
        responses.add(
            responses.GET,
            u'https://example.gitlab.com/api/v4/projects/%s' % project_id,
            json={'id': project_id, 'path_with_namespace': project_name}
        )

        assert self.installation.get_issue(issue_id='%s#%s' % (project_id, issue_iid), data={}) == {
            'key': key,
            'description': 'This is the description',
            'title': 'hello',
            'url': 'https://example.gitlab.com/%s/issues/%s' % (project_name, issue_iid),
            'project': project_id,
            'metadata': {
                'display_name': key,
            }
        }

    @responses.activate
    def test_create_issue_default_project_in_group_api_call(self):
        group_description = (
            u'Sentry Issue: [%s](%s)\n\n'
            '```\nStacktrace (most recent call last):\n\n'
            '  File "sentry/models/foo.py", line 29, in build_msg\n'
            '    string_max_length=self.string_max_length)\n\nmessage\n```'
        ) % (
            self.group.qualified_short_id,
            absolute_uri(self.group.get_absolute_url(params={'referrer': 'gitlab_integration'})),
        )
        project_id = 10
        project_name = 'This_is / a_project'
        org_integration = self.installation.org_integration
        org_integration.config['project_issue_defaults'] = {
            six.text_type(self.group.project_id): {'project': project_id}
        }
        org_integration.save()

        responses.add(
            responses.GET,
            u'https://example.gitlab.com/api/v4/groups/%s/projects' % self.installation.model.metadata['group_id'],
            json=[
                {'name_with_namespace': 'getsentry / sentry', 'id': 1},
                {'name_with_namespace': project_name, 'id': project_id},
                {'name_with_namespace': 'getsentry / hello', 'id': 22},
            ]
        )
        responses.add(
            responses.GET,
            u'https://example.gitlab.com/api/v4/projects/%s' % project_id,
            json={'path_with_namespace': project_name, 'id': project_id}
        )
        assert self.installation.get_create_issue_config(self.group) == [
            {
                'url': '/extensions/gitlab/search/baz/%d/' % self.installation.model.id,
                'name': 'project',
                'required': True,
                'choices': [
                    (1, u'getsentry / sentry'),
                    (10, u'This_is / a_project'),
                    (22, u'getsentry / hello')
                ],
                'defaultValue': project_id,
                'type': 'select',
                'label': 'Gitlab Project'
            },
            {
                'name': 'title',
                'label': 'Title',
                'default': self.group.get_latest_event().error(),
                'type': 'string',
                'required': True,
            },
            {
                'name': 'description',
                'label': 'Description',
                'default': group_description,
                'type': 'textarea',
                'autosize': True,
                'maxRows': 10,
            }
        ]

    @responses.activate
    def test_create_issue_default_project_not_in_api_call(self):
        group_description = (
            u'Sentry Issue: [%s](%s)\n\n'
            '```\nStacktrace (most recent call last):\n\n'
            '  File "sentry/models/foo.py", line 29, in build_msg\n'
            '    string_max_length=self.string_max_length)\n\nmessage\n```'
        ) % (
            self.group.qualified_short_id,
            absolute_uri(self.group.get_absolute_url(params={'referrer': 'gitlab_integration'})),
        )
        project_id = 10
        project_name = 'This_is / a_project'
        org_integration = self.installation.org_integration
        org_integration.config['project_issue_defaults'] = {
            six.text_type(self.group.project_id): {'project': project_id}
        }
        org_integration.save()

        responses.add(
            responses.GET,
            u'https://example.gitlab.com/api/v4/groups/%s/projects' % self.installation.model.metadata['group_id'],
            json=[
                {'name_with_namespace': 'getsentry / sentry', 'id': 1},
                {'name_with_namespace': 'getsentry / hello', 'id': 22},
            ]
        )
        responses.add(
            responses.GET,
            u'https://example.gitlab.com/api/v4/projects/%s' % project_id,
            json={'name_with_namespace': project_name, 'id': project_id}
        )
        assert self.installation.get_create_issue_config(self.group) == [
            {
                'url': '/extensions/gitlab/search/baz/%d/' % self.installation.model.id,
                'name': 'project',
                'required': True,
                'choices': [
                    (10, u'This_is / a_project'),
                    (1, u'getsentry / sentry'),
                    (22, u'getsentry / hello')
                ],
                'defaultValue': project_id,
                'type': 'select',
                'label': 'Gitlab Project'
            },
            {
                'name': 'title',
                'label': 'Title',
                'default': self.group.get_latest_event().error(),
                'type': 'string',
                'required': True,
            },
            {
                'name': 'description',
                'label': 'Description',
                'default': group_description,
                'type': 'textarea',
                'autosize': True,
                'maxRows': 10,
            }
        ]

    @responses.activate
    def test_create_issue_no_projects(self):
        group_description = (
            u'Sentry Issue: [%s](%s)\n\n'
            '```\nStacktrace (most recent call last):\n\n'
            '  File "sentry/models/foo.py", line 29, in build_msg\n'
            '    string_max_length=self.string_max_length)\n\nmessage\n```'
        ) % (
            self.group.qualified_short_id,
            absolute_uri(self.group.get_absolute_url(params={'referrer': 'gitlab_integration'})),
        )

        responses.add(
            responses.GET,
            u'https://example.gitlab.com/api/v4/groups/%s/projects' % self.installation.model.metadata['group_id'],
            json=[]
        )
        assert self.installation.get_create_issue_config(self.group) == [
            {
                'url': '/extensions/gitlab/search/baz/%d/' % self.installation.model.id,
                'name': 'project',
                'required': True,
                'choices': [],
                'defaultValue': '',
                'type': 'select',
                'label': 'Gitlab Project'
            },
            {
                'name': 'title',
                'label': 'Title',
                'default': self.group.get_latest_event().error(),
                'type': 'string',
                'required': True,
            },
            {
                'name': 'description',
                'label': 'Description',
                'default': group_description,
                'type': 'textarea',
                'autosize': True,
                'maxRows': 10,
            }
        ]
