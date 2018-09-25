from __future__ import absolute_import


from time import time

from sentry.models import Identity, IdentityProvider, Integration
from sentry.testutils import APITestCase
from sentry.utils.http import absolute_uri


class GitlabIssuesTest(APITestCase):
    provider = 'gitlab'

    def setUp(self):
        self.login_as(self.user)
        self.group = self.create_group()
        self.create_event(group=self.group)

        integration = Integration.objects.create(
            provider=self.provider,
            name='Example Gitlab',
            metadata={
                'base_url': 'https://example.gitlab.com',
                'domain_name': 'example.gitlab.com',
                'verify_ssl': False,
            }
        )
        identity = Identity.objects.create(
            idp=IdentityProvider.objects.create(
                type=self.provider,
                config={},
            ),
            user=self.user,
            external_id='gitlab123',
            data={
                'access_token': '123456789',
                'expires': time() + 1234567,
            }
        )
        integration.add_organization(self.organization, self.user, identity.id)
        self.installation = integration.get_installation(self.organization.id)

    def test_make_external_key(self):
        data = {
            'key': '7',
            'project': 'project/project'
        }
        assert self.installation.make_external_key(data) == 'example.gitlab.com:project/project#7'

    def test_get_issue_url(self):
        issue_id = 'example.gitlab.com:project/project#7'
        assert self.installation.get_issue_url(
            issue_id) == 'https://example.gitlab.com/project/project/issues/7'

    def test_get_create_issue_config(self):
        group_description = (
            u'Sentry Issue: [%s](%s)\n\n'
            '```\nStacktrace (most recent call last):\n\n'
            '  File "sentry/models/foo.py", line 29, in build_msg\n'
            '    string_max_length=self.string_max_length)\n\nmessage\n```'
        ) % (
            self.group.qualified_short_id,
            absolute_uri(self.group.get_absolute_url()),
        )
        assert self.installation.get_create_issue_config(self.group) == [
            {
                'url': '/extensions/gitlab/search/baz/%d/' % self.installation.model.id,
                'updatesForm': True,
                'name': 'project',
                'default': ' ',
                'required': True,
                'defaultLabel': ' ',
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

    def test_get_link_issue_config(self):
        default_project = ' '
        autocomplete_url = '/extensions/gitlab/search/baz/%d/' % self.installation.model.id
        assert self.installation.get_link_issue_config(self.group) == [
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

    def test_create_issue(self):
        pass

    def test_link_issue(self):
        pass
