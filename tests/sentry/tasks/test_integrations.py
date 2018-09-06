from __future__ import absolute_import, print_function

from time import time

from sentry.models import Integration, Identity, IdentityProvider
from sentry.testutils import TestCase
from sentry.tasks.integrations import kickoff_vsts_subscription_check

import responses


class VstsSubscriptionCheckTest(TestCase):
    def setUp(self):
        responses.add(
            responses.GET,
            'https://vsts1.visualstudio.com/_apis/hooks/subscriptions/subscription1',
            json={'status': 'disabledBySystem'}
        )
        responses.add(
            responses.PUT,
            'https://vsts1.visualstudio.com/_apis/hooks/subscriptions/subscription1',
            json={}
        )
        responses.add(
            responses.GET,
            'https://vsts1.visualstudio.com/_apis/hooks/subscriptions/subscription3',
            json={'status': 'enabled'}
        )
        responses.add(
            responses.PUT,
            'https://vsts1.visualstudio.com/_apis/hooks/subscriptions/subscription3',
            json={}
        )
        self.identity = Identity.objects.create(
            idp=IdentityProvider.objects.create(
                type='vsts',
                config={}
            ),
            user=self.user,
            external_id='user_identity',
            data={
                'access_token': 'vsts-access-token',
                'expires': time() + 50000,
            }
        )

    @responses.activate
    def test_kickoff_subscription(self):
        integration3_check_time = time()
        integration1 = Integration.objects.create(
            provider='vsts',
            name='vsts1',
            external_id='vsts1',
            metadata={
                'domain_name': 'https://vsts1.visualstudio.com/',
                'subscription': {
                    'id': 'subscription1',
                }
            }
        )
        integration1.add_organization(self.organization.id, self.identity.id)
        integration2 = Integration.objects.create(
            provider='vsts',
            name='vsts2',
            external_id='vsts2',
            metadata={},
        )
        integration2.add_organization(self.organization.id, self.identity.id)
        integration3 = Integration.objects.create(
            provider='vsts',
            name='vsts3',
            external_id='vsts3',
            metadata={
                'subscription': {
                    'id': 'subscription3',
                    'check': integration3_check_time,
                }
            }
        )
        integration3.add_organization(self.organization.id, self.identity.id)

        with self.tasks():
            kickoff_vsts_subscription_check()

        assert 'check' in Integration.objects.get(
            provider='vsts',
            external_id='vsts1',
        ).metadata['subscription']
        # TODO(lb): what to do if there's no subscription stored?
        assert integration3_check_time == Integration.objects.get(
            provider='vsts',
            external_id='vsts3',
        ).metadata['subscription']['check']
