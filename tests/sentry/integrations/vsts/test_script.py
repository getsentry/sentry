from __future__ import absolute_import
from sentry.models import Identity, IdentityProvider, Integration
import responses
from time import time
from sentry.testutils import APITestCase
from sentry.integrations.vsts.vsts_script import fix_integrations
SUBSCRIPTION_EXAMPLE = {
    "count": 1,
    "value": [
        {
            "id": "324f4da4-11f0-484f-a833-e6dadd29732f",
            "url": "https://dev.azure.com/lauryndbrown/_apis/hooks/subscriptions/324f4da4-11f0-484f-a833-e6dadd29732f",
            "status": "enabled",
            "publisherId": "tfs",
            "eventType": "workitem.updated",
            "subscriber": None,
            "resourceVersion": "1.0",
            "eventDescription": "Any work item",
            "consumerId": "webHooks",
            "consumerActionId": "httpRequest",
            "actionDescription": "To host lauryn.ngrok.io",
            "createdBy": {
                "displayName": "Lauryn Brown",
                "id": "e8d08ed9-cce6-4943-b232-16ea231cf2f5",
                "uniqueName": "lauryndbrown@gmail.com",
                "descriptor": "msa.NTJkZTY3YzctMmIwYi03MTE1LWFmM2ItYmQ0Y2MzNDQyYzU3"
            },
            "createdDate": "2018-10-11T23:45:36.52Z",
            "modifiedBy": {
                "displayName": "Lauryn Brown",
                "id": "e8d08ed9-cce6-4943-b232-16ea231cf2f5",
                "uniqueName": "lauryndbrown@gmail.com",
                "descriptor": "msa.NTJkZTY3YzctMmIwYi03MTE1LWFmM2ItYmQ0Y2MzNDQyYzU3"
            },
            "modifiedDate": "2018-10-11T23:45:36.52Z",
            "publisherInputs": {
                "tfsSubscriptionId": "78aa28b2-2d3f-44e9-9fcd-992ec0c9a5fc"
            },
            "consumerInputs": {
                "httpHeaders": "shared-secret:e5f27cc5d254421daea2d3f1dd06b08f438a2f3a91e74aae9794a62b07ca1491",
                "resourceDetailsToSend": "all",
                "url": "http://testserver/extensions/vsts/issue-updated/"
            },
            "_links": {
                "self": {
                    "href": "https://dev.azure.com/lauryndbrown/_apis/hooks/subscriptions/324f4da4-11f0-484f-a833-e6dadd29732f"
                },
                "consumer": {
                    "href": "https://dev.azure.com/lauryndbrown/_apis/hooks/consumers/webHooks"
                },
                "actions": {
                    "href": "https://dev.azure.com/lauryndbrown/_apis/hooks/consumers/webHooks/actions"
                },
                "notifications": {
                    "href": "https://dev.azure.com/lauryndbrown/_apis/hooks/subscriptions/324f4da4-11f0-484f-a833-e6dadd29732f/notifications"
                },
                "publisher": {
                    "href": "https://dev.azure.com/lauryndbrown/_apis/hooks/publishers/tfs"
                }
            }
        }
    ]
}


class VstsScriptTest(APITestCase):
    def setUp(self):
        self.organization_1 = self.create_organization()
        self.organization_2 = self.create_organization()
        self.organization_3 = self.create_organization()
        self.user_2 = self.create_user()
        integrations = self.create_integrations()
        self.subscription_1_id = 'vsts-subscription-1'
        self.subscription_2_id = 'vsts-subscription-2'
        responses.add(
            responses.GET,
            '%s_apis/hooks/subscriptions?api-version=4.1' % integrations[0].metadata['domain_name'],
            json=self.create_subscription_dict(self.subscription_2_id, 'disabledBySystem')
        )
        responses.add(
            responses.PUT,
            '%s_apis/hooks/subscriptions/%s?api-version=4.1' % (
                integrations[0].metadata['domain_name'], self.subscription_2_id),
            json={}
        )

    def create_subscription_dict(self, subscription_id, status):
        subscription = dict(SUBSCRIPTION_EXAMPLE)
        subscription['value'][0]['id'] = subscription_id
        subscription['value'][0]['status'] = status
        return subscription

    def create_integrations(self):
        identity_provider = IdentityProvider.objects.create(type='vsts')
        self.identity_1 = Identity.objects.create(
            idp=identity_provider,
            user=self.user,
            external_id='vsts_id_1',
            data={
                'access_token': 'access_token',
                'refresh_token': 'qwertyuiop',
                'expires': int(time()) + int(1234567890),
            }
        )
        self.identity_2 = Identity.objects.create(
            idp=identity_provider,
            user=self.user_2,
            external_id='vsts_id_2',
            data={
                'access_token': 'access_token',
                'refresh_token': 'qwertyuiop',
                'expires': int(time()) + int(1234567890),
            }
        )
        integration_with_subscription = Integration.objects.create(
            provider='vsts',
            name='vsts-integration-1',
            external_id='vsts-integration-1',
            metadata={
                'domain_name': 'https://dev.azure.com/vsts-integration-1/',
                'subscription': {
                    'id': 'subscription-1-id',
                    'secret': 'subscription-1-secret',
                }
            }
        )
        integration_with_subscription.add_organization(
            self.organization_1, default_auth_id=self.identity_1.id)

        integration_subscription_overwritten = Integration.objects.create(
            provider='vsts',
            external_id='vsts-integration-2',
            name='vsts-integration-2',
            metadata={
                'domain_name': 'https://dev.azure.com/vsts-integration-2/',
            }
        )
        integration_subscription_overwritten.add_organization(
            self.organization_2, default_auth_id=self.identity_1.id)
        integration_subscription_overwritten.add_organization(
            self.organization_3, default_auth_id=self.identity_2.id)

        return [integration_subscription_overwritten, integration_with_subscription]

    @responses.activate
    def test_simple(self):
        fix_integrations()
        integrations = Integration.objects.all()
        for i in integrations:
            assert 'subscription' in i.metadata
        assert len(responses.calls) == 2
        assert responses.calls[0].request.url == 'https://dev.azure.com/%s/_apis/hooks/subscriptions?api-version=4.1' % integrations[1].name
        assert responses.calls[1].request.url == 'https://dev.azure.com/%s/_apis/hooks/subscriptions/%s?api-version=4.1' % (
            integrations[1].name, self.subscription_2_id)
