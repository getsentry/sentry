from __future__ import absolute_import

import six

from sentry.models import ExternalIssue, GroupLink, Integration
from sentry.testutils import APITestCase
from sentry.utils.http import absolute_uri


class GroupIntegrationDetailsTest(APITestCase):
    def test_simple_get_link(self):
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = Integration.objects.create(
            provider='example',
            name='Example',
        )
        integration.add_organization(org.id)

        path = '/api/0/issues/{}/integrations/{}/?action=link'.format(group.id, integration.id)

        with self.feature('organizations:integrations-issue-basic'):
            response = self.client.get(path)
            provider = integration.get_provider()

            assert response.data == {
                'id': six.text_type(integration.id),
                'name': integration.name,
                'icon': integration.metadata.get('icon'),
                'domainName': integration.metadata.get('domain_name'),
                'accountType': integration.metadata.get('account_type'),
                'status': integration.get_status_display(),
                'provider': {
                    'key': provider.key,
                    'name': provider.name,
                    'canAdd': provider.can_add,
                    'canDisable': provider.can_disable,
                    'features': [f.value for f in provider.features],
                    'aspects': provider.metadata.aspects,
                },
                'linkIssueConfig': [{
                    'default': '',
                    'type': 'string',
                    'name': 'externalIssue',
                    'label': 'Issue',
                }]
            }

    def test_simple_get_create(self):
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        self.create_event(group=group)
        integration = Integration.objects.create(
            provider='example',
            name='Example',
        )
        integration.add_organization(org.id)

        path = '/api/0/issues/{}/integrations/{}/?action=create'.format(group.id, integration.id)

        with self.feature('organizations:integrations-issue-basic'):
            response = self.client.get(path)
            provider = integration.get_provider()

            assert response.data == {
                'id': six.text_type(integration.id),
                'name': integration.name,
                'icon': integration.metadata.get('icon'),
                'domainName': integration.metadata.get('domain_name'),
                'accountType': integration.metadata.get('account_type'),
                'status': integration.get_status_display(),
                'provider': {
                    'key': provider.key,
                    'name': provider.name,
                    'canAdd': provider.can_add,
                    'canDisable': provider.can_disable,
                    'features': [f.value for f in provider.features],
                    'aspects': provider.metadata.aspects,
                },
                'createIssueConfig': [
                    {
                        'default': 'message',
                        'type': 'string',
                        'name': 'title',
                        'label': 'Title',
                        'required': True,
                    }, {
                        'default': ('Sentry Issue: [%s](%s)\n\n```\n'
                                    'Stacktrace (most recent call last):\n\n  '
                                    'File "sentry/models/foo.py", line 29, in build_msg\n    '
                                    'string_max_length=self.string_max_length)\n\nmessage\n```'
                                    ) % (group.qualified_short_id, absolute_uri(group.get_absolute_url())),
                        'type': 'textarea',
                        'name': 'description',
                        'label': 'Description',
                        'autosize': True,
                        'maxRows': 10,
                    }
                ]
            }

    def test_get_feature_disabled(self):
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        self.create_event(group=group)
        integration = Integration.objects.create(
            provider='example',
            name='Example',
        )
        integration.add_organization(org.id)

        path = '/api/0/issues/{}/integrations/{}/?action=create'.format(group.id, integration.id)

        response = self.client.get(path)
        assert response.status_code == 400
        assert response.data['detail'] == 'Your organization does not have access to this feature.'

    def test_simple_put(self):
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = Integration.objects.create(
            provider='example',
            name='Example',
        )
        integration.add_organization(org.id)

        path = '/api/0/issues/{}/integrations/{}/'.format(group.id, integration.id)

        with self.feature('organizations:integrations-issue-basic'):
            response = self.client.put(path, data={
                'externalIssue': 'APP-123'
            })

            assert response.status_code == 201
            external_issue = ExternalIssue.objects.get(
                key='APP-123',
                integration_id=integration.id,
                organization_id=org.id,
            )
            assert external_issue.title == 'This is a test external issue title'
            assert external_issue.description == 'This is a test external issue description'
            assert GroupLink.objects.filter(
                linked_type=GroupLink.LinkedType.issue,
                group_id=group.id,
                linked_id=external_issue.id,
            ).exists()

    def test_put_feature_disabled(self):
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = Integration.objects.create(
            provider='example',
            name='Example',
        )
        integration.add_organization(org.id)

        path = '/api/0/issues/{}/integrations/{}/'.format(group.id, integration.id)

        response = self.client.put(path, data={
            'externalIssue': 'APP-123'
        })
        assert response.status_code == 400
        assert response.data['detail'] == 'Your organization does not have access to this feature.'

    def test_simple_post(self):
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = Integration.objects.create(
            provider='example',
            name='Example',
        )
        integration.add_organization(org.id)

        path = '/api/0/issues/{}/integrations/{}/'.format(group.id, integration.id)

        with self.feature('organizations:integrations-issue-basic'):
            response = self.client.post(path, data={})
            assert response.status_code == 400
            assert response.data['non_field_errors'] == ['Assignee is required']

            response = self.client.post(path, data={'assignee': 'foo@sentry.io'})
            assert response.status_code == 201

            external_issue = ExternalIssue.objects.get(
                key='APP-123',
                integration_id=integration.id,
                organization_id=org.id,
            )
            assert external_issue.description == u'This is a test external issue description'
            assert external_issue.title == u'This is a test external issue title'

            assert GroupLink.objects.filter(
                linked_type=GroupLink.LinkedType.issue,
                group_id=group.id,
                linked_id=external_issue.id,
            ).exists()

    def test_post_feature_disabled(self):
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = Integration.objects.create(
            provider='example',
            name='Example',
        )
        integration.add_organization(org.id)

        path = '/api/0/issues/{}/integrations/{}/'.format(group.id, integration.id)

        response = self.client.post(path, data={})
        assert response.status_code == 400
        assert response.data['detail'] == 'Your organization does not have access to this feature.'

    def test_simple_delete(self):
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = Integration.objects.create(
            provider='example',
            name='Example',
        )
        integration.add_organization(org.id)

        external_issue = ExternalIssue.objects.get_or_create(
            organization_id=org.id,
            integration_id=integration.id,
            key='APP-123',
        )[0]

        group_link = GroupLink.objects.get_or_create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )[0]

        path = '/api/0/issues/{}/integrations/{}/?externalIssue={}'.format(
            group.id, integration.id, external_issue.id,
        )

        with self.feature('organizations:integrations-issue-basic'):
            response = self.client.delete(path)

            assert response.status_code == 204
            assert not ExternalIssue.objects.filter(id=external_issue.id).exists()
            assert not GroupLink.objects.filter(id=group_link.id).exists()

    def test_delete_feature_disabled(self):
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = Integration.objects.create(
            provider='example',
            name='Example',
        )
        integration.add_organization(org.id)

        external_issue = ExternalIssue.objects.get_or_create(
            organization_id=org.id,
            integration_id=integration.id,
            key='APP-123',
        )[0]

        GroupLink.objects.get_or_create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )[0]

        path = '/api/0/issues/{}/integrations/{}/?externalIssue={}'.format(
            group.id, integration.id, external_issue.id,
        )

        response = self.client.delete(path)
        assert response.status_code == 400
        assert response.data['detail'] == 'Your organization does not have access to this feature.'
