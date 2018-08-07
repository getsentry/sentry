from __future__ import absolute_import

from sentry.identity.vsts import VSTSIdentityProvider
from sentry.integrations.vsts import VstsIntegration, VstsIntegrationProvider
from sentry.models import (
    Integration, IntegrationExternalProject, OrganizationIntegration, Repository
)
from .testutils import VstsIntegrationTestCase, CREATE_SUBSCRIPTION


class VstsIntegrationProviderTest(VstsIntegrationTestCase):
    # Test data setup in ``VstsIntegrationTestCase``

    def test_basic_flow(self):
        self.assert_installation()

        integration = Integration.objects.get(provider='vsts')

        assert integration.external_id == self.vsts_account_id
        assert integration.name == self.vsts_account_name

        metadata = integration.metadata
        assert metadata['scopes'] == list(VSTSIdentityProvider.oauth_scopes)
        assert metadata['subscription']['id'] == \
            CREATE_SUBSCRIPTION['publisherInputs']['tfsSubscriptionId']
        assert metadata['domain_name'] == '{}.visualstudio.com'.format(
            self.vsts_account_name
        )

    def test_migrate_repositories(self):
        accessible_repo = Repository.objects.create(
            organization_id=self.organization.id,
            name=self.project_a['name'],
            url='https://{}.visualstudio.com/DefaultCollection/_git/{}'.format(
                self.vsts_account_name,
                self.repo_name,
            ),
            provider='visualstudio',
            external_id=self.repo_id,
        )

        inaccessible_repo = Repository.objects.create(
            organization_id=self.organization.id,
            name='NotReachable',
            url='https://randoaccount.visualstudio.com/Product/_git/NotReachable',
            provider='visualstudio',
            external_id='123456789',
        )

        self.assert_installation()
        integration = Integration.objects.get(provider='vsts')

        assert Repository.objects.get(
            id=accessible_repo.id,
        ).integration_id == integration.id

        assert Repository.objects.get(
            id=inaccessible_repo.id,
        ).integration_id is None

    def test_build_integration(self):
        state = {
            'account': {
                'AccountName': self.vsts_account_name,
                'AccountId': self.vsts_account_id,
            },
            'instance': '{}.visualstudio.com'.format(self.vsts_account_name),
            'identity': {
                'data': {
                    'access_token': self.access_token,
                    'expires_in': '3600',
                    'refresh_token': self.refresh_token,
                    'token_type': 'jwt-bearer',
                },
            },
        }

        integration = VstsIntegrationProvider()
        integration_dict = integration.build_integration(state)

        assert integration_dict['name'] == self.vsts_account_name
        assert integration_dict['external_id'] == self.vsts_account_id
        assert integration_dict['metadata']['domain_name'] == \
            '{}.visualstudio.com'.format(self.vsts_account_name)

        assert integration_dict['user_identity']['type'] == 'vsts'
        assert integration_dict['user_identity']['external_id'] == \
            self.vsts_account_id
        assert integration_dict['user_identity']['scopes'] == sorted(
            VSTSIdentityProvider.oauth_scopes)

    def test_webhook_subscription_created_once(self):
        self.assert_installation()

        state = {
            'account': {
                'AccountName': self.vsts_account_name,
                'AccountId': self.vsts_account_id,
            },
            'instance': '{}.visualstudio.com'.format(self.vsts_account_name),
            'identity': {
                'data': {
                    'access_token': self.access_token,
                    'expires_in': '3600',
                    'refresh_token': self.refresh_token,
                    'token_type': 'jwt-bearer',
                },
            },
        }

        # The above already created the Webhook, so subsequent calls to
        # ``build_integration`` should omit that data.
        data = VstsIntegrationProvider().build_integration(state)
        assert 'subscription' not in data['metadata']


class VstsIntegrationTest(VstsIntegrationTestCase):
    def test_get_organization_config(self):
        self.assert_installation()
        integration = Integration.objects.get(provider='vsts')

        fields = integration.get_installation(
            integration.organizations.first().id
        ).get_organization_config()

        print [field['name'] for field in fields]

        assert [field['name'] for field in fields] == [
            'sync_status_reverse',
            'sync_status_forward',
            'sync_comments',
            'sync_forward_assignment',
            'sync_reverse_assignment',
        ]

    def test_update_organization_config_remove_all(self):
        self.assert_installation()

        model = Integration.objects.get(provider='vsts')
        integration = VstsIntegration(model, self.organization.id)

        org_integration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id,
        )

        data = {
            'sync_status_forward': {},
            'other_option': 'hello',
        }
        IntegrationExternalProject.objects.create(
            organization_integration_id=org_integration.id,
            external_id=1,
            resolved_status='ResolvedStatus1',
            unresolved_status='UnresolvedStatus1',
        )
        IntegrationExternalProject.objects.create(
            organization_integration_id=org_integration.id,
            external_id=2,
            resolved_status='ResolvedStatus2',
            unresolved_status='UnresolvedStatus2',
        )
        IntegrationExternalProject.objects.create(
            organization_integration_id=org_integration.id,
            external_id=3,
            resolved_status='ResolvedStatus3',
            unresolved_status='UnresolvedStatus3',
        )

        integration.update_organization_config(data)

        external_projects = IntegrationExternalProject.objects \
            .all() \
            .values_list('external_id', flat=True)

        assert list(external_projects) == []

        config = OrganizationIntegration.objects.get(
            organization_id=org_integration.organization_id,
            integration_id=org_integration.integration_id
        ).config

        assert config == {
            'sync_status_forward': False,
            'other_option': 'hello',
        }

    def test_update_organization_config(self):
        self.assert_installation()

        org_integration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id,
        )

        model = Integration.objects.get(provider='vsts')
        integration = VstsIntegration(model, self.organization.id)

        data = {
            'sync_status_forward': {
                1: {
                    'on_resolve': 'ResolvedStatus1',
                    'on_unresolve': 'UnresolvedStatus1',
                },
                2: {
                    'on_resolve': 'ResolvedStatus2',
                    'on_unresolve': 'UnresolvedStatus2',
                },
                4: {
                    'on_resolve': 'ResolvedStatus4',
                    'on_unresolve': 'UnresolvedStatus4',
                },
            },
            'other_option': 'hello',
        }
        IntegrationExternalProject.objects.create(
            organization_integration_id=org_integration.id,
            external_id=1,
            resolved_status='UpdateMe',
            unresolved_status='UpdateMe',
        )
        IntegrationExternalProject.objects.create(
            organization_integration_id=org_integration.id,
            external_id=2,
            resolved_status='ResolvedStatus2',
            unresolved_status='UnresolvedStatus2',
        )
        IntegrationExternalProject.objects.create(
            organization_integration_id=org_integration.id,
            external_id=3,
            resolved_status='ResolvedStatus3',
            unresolved_status='UnresolvedStatus3',
        )

        integration.update_organization_config(data)

        external_projects = IntegrationExternalProject.objects \
            .all() \
            .order_by('external_id')

        assert external_projects[0].external_id == '1'
        assert external_projects[0].resolved_status == 'ResolvedStatus1'
        assert external_projects[0].unresolved_status == 'UnresolvedStatus1'

        assert external_projects[1].external_id == '2'
        assert external_projects[1].resolved_status == 'ResolvedStatus2'
        assert external_projects[1].unresolved_status == 'UnresolvedStatus2'

        assert external_projects[2].external_id == '4'
        assert external_projects[2].resolved_status == 'ResolvedStatus4'
        assert external_projects[2].unresolved_status == 'UnresolvedStatus4'

        config = OrganizationIntegration.objects.get(
            organization_id=org_integration.organization_id,
            integration_id=org_integration.integration_id
        ).config

        assert config == {
            'sync_status_forward': True,
            'other_option': 'hello',
        }
