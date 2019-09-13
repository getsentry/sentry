from __future__ import absolute_import

import six

from sentry.models import Integration
from sentry.testutils import APITestCase


class OrganizationIntegrationsListTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)
        org = self.create_organization(owner=self.user, name="baz")
        integration = Integration.objects.create(provider="example", name="Example")
        integration.add_organization(org, self.user)
        path = u"/api/0/organizations/{}/integrations/".format(org.slug)

        response = self.client.get(path, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == six.text_type(integration.id)
