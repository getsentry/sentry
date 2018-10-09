from __future__ import absolute_import

from sentry.testutils import APITestCase
from time import time
from sentry.models import Identity, IdentityProvider, Integration


class GitLabTestCase(APITestCase):
    provider = 'gitlab'

    def setUp(self):
        self.login_as(self.user)
        integration = Integration.objects.create(
            provider=self.provider,
            name='Example Gitlab',
            metadata={
                'base_url': 'https://example.gitlab.com',
                'domain_name': 'example.gitlab.com/sentry-group',
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
