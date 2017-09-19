from __future__ import absolute_import

import pytest

from sentry.integrations.example import ExampleSetupView
from sentry.models import Integration, OrganizationIntegration
from sentry.testutils import AuthProviderTestCase, PermissionTestCase


class IntegrationSetupPermissionTest(PermissionTestCase):
    def setUp(self):
        super(IntegrationSetupPermissionTest, self).setUp()
        self.path = '/organizations/{}/integrations/example/setup/'.format(
            self.organization.slug,
        )

    def test_teamless_admin_cannot_load(self):
        with self.feature('organizations:integrations-v3'):
            self.assert_teamless_admin_cannot_access(self.path)

    def test_team_admin_cannot_load(self):
        with self.feature('organizations:integrations-v3'):
            self.assert_team_admin_cannot_access(self.path)

    # this currently redirects the user
    @pytest.mark.xfail
    def test_manager_can_load(self):
        with self.feature('organizations:integrations-v3'):
            self.assert_role_can_access(self.path, 'manager')

    # this currently redirects the user
    @pytest.mark.xfail
    def test_owner_can_load(self):
        with self.feature('organizations:integrations-v3'):
            self.assert_owner_can_access(self.path)


class IntegrationSetupTest(AuthProviderTestCase):
    def setUp(self):
        super(IntegrationSetupTest, self).setUp()
        self.organization = self.create_organization(name='foo', owner=self.user)
        self.login_as(self.user)
        self.path = '/organizations/{}/integrations/example/setup/'.format(
            self.organization.slug,
        )

    def test_basic_flow(self):
        with self.feature('organizations:integrations-v3'):
            resp = self.client.get(self.path + '?init=1&callback=test')
            assert resp.status_code == 302

            resp = self.client.get(self.path)
            assert resp.status_code == 200
            assert ExampleSetupView.TEMPLATE in resp.content.decode('utf-8')

            resp = self.client.post(self.path, {'name': 'test'})

            assert resp.status_code == 200
            assert 'window.opener.postMessage(' in resp.content

        integration = Integration.objects.get(provider='example')
        assert integration.external_id == 'test'
        assert integration.name == 'test'
        assert integration.metadata == {}
        assert OrganizationIntegration.objects.filter(
            integration=integration,
            organization=self.organization,
        ).exists()
