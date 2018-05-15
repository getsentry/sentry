from __future__ import absolute_import

import six

from sentry.models import Integration
from sentry.testutils import APITestCase


class GroupIntegrationsTest(APITestCase):
    def test_simple_get(self):
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = Integration.objects.create(
            provider='example',
            name='Example',
        )
        integration.add_organization(org.id)

        path = '/api/0/issues/{}/integrations/'.format(group.id)

        response = self.client.get(path)

        assert response.data[0] == {
            'id': six.text_type(integration.id),
            'name': integration.name,
            'icon': integration.metadata.get('icon'),
            'domain_name': integration.metadata.get('domain_name'),
            'provider': {
                'key': integration.get_provider().key,
                'name': integration.get_provider().name,
            },
        }
