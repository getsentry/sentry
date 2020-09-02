from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.utils.encoding import force_bytes
from exam import before

from sentry import identity
from sentry.identity.providers.dummy import DummyProvider
from sentry.models import Identity, IdentityProvider, IdentityStatus
from sentry.testutils.cases import TestCase


class AccountIdentityTest(TestCase):
    @before
    def setup_dummy_identity_provider(self):
        identity.register(DummyProvider)
        self.addCleanup(identity.unregister, DummyProvider)

    def test_associate_identity(self):
        user = self.create_user()
        organization = self.create_organization(name="foo", owner=user)
        IdentityProvider.objects.create(type="dummy", external_id="1234", config={})

        self.login_as(user)

        path = reverse(
            "sentry-account-associate-identity", args=[organization.slug, "dummy", "1234"]
        )
        resp = self.client.get(path)

        assert resp.status_code == 200
        assert resp.context["organization"] == organization
        assert isinstance(resp.context["provider"], DummyProvider)

        resp = self.client.post(path)

        assert resp.status_code == 200
        assert resp.content == force_bytes(DummyProvider.TEMPLATE)

        resp = self.client.post(path, data={"email": "rick@example.com"})
        ident = Identity.objects.get(user=user)

        assert resp.status_code == 302
        assert ident.external_id == "rick@example.com"
        assert ident.status == IdentityStatus.VALID
