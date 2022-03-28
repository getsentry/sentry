from django.urls import reverse

from ..base import TestCase


class IntegrationTestCase(TestCase):
    provider = None

    def setUp(self):
        from sentry.integrations.pipeline import IntegrationPipeline

        super().setUp()

        self.organization = self.create_organization(name="foo", owner=self.user)
        self.login_as(self.user)
        self.request = self.make_request(self.user)
        # XXX(dcramer): this is a bit of a hack, but it helps contain this test
        self.pipeline = IntegrationPipeline(
            request=self.request, organization=self.organization, provider_key=self.provider.key
        )

        self.init_path = reverse(
            "sentry-organization-integrations-setup",
            kwargs={"organization_slug": self.organization.slug, "provider_id": self.provider.key},
        )

        self.setup_path = reverse(
            "sentry-extension-setup", kwargs={"provider_id": self.provider.key}
        )
        self.configure_path = f"/extensions/{self.provider.key}/configure/"

        self.pipeline.initialize()
        self.save_session()

    def assertDialogSuccess(self, resp):
        assert b'window.opener.postMessage({"success":true' in resp.content
