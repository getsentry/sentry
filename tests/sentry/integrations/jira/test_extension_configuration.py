from django.test import Client

from sentry.integrations.jira.views import SALT, JiraExtensionConfigurationView
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import control_silo_test
from sentry.utils import json
from sentry.utils.signing import sign

CONFIGURE_URL = "/extensions/jira/configure/"


def _build_signed_params(
    external_id: str = "example.atlassian.net",
    base_url: str = "https://example.atlassian.net",
) -> str:
    metadata = {
        "oauth_client_id": "client-id",
        "public_key": "pubkey",
        "shared_secret": "secret",
        "base_url": base_url,
        "domain_name": base_url.replace("https://", ""),
    }
    return sign(salt=SALT, external_id=external_id, metadata=json.dumps(metadata))


@control_silo_test
class JiraExtensionConfigurationTest(TestCase):
    def test_map_params_to_state(self) -> None:
        config_view = JiraExtensionConfigurationView()
        metadata = {"my_param": "test"}
        data = {"metadata": json.dumps(metadata)}
        signed_data = sign(salt=SALT, **data)
        params = {"signed_params": signed_data}
        assert {"metadata": metadata} == config_view.map_params_to_state(params)

    @with_feature("organizations:jira-confirm-installation")
    def test_post_without_csrf_token_is_rejected(self) -> None:
        signed = _build_signed_params()
        csrf_client = Client(enforce_csrf_checks=True)

        response = csrf_client.post(
            f"{CONFIGURE_URL}?signed_params={signed}&orgSlug={self.organization.slug}"
        )

        assert response.status_code == 403
        assert not Integration.objects.filter(provider="jira").exists()

    @with_feature("organizations:jira-confirm-installation")
    def test_get_renders_confirmation_without_installing_integration(self) -> None:
        self.login_as(self.user)
        signed = _build_signed_params(base_url="https://attacker.atlassian.net")
        response = self.client.get(
            f"{CONFIGURE_URL}?signed_params={signed}&orgSlug={self.organization.slug}"
        )

        assert response.status_code == 200
        # confirmation page shows the Jira tenant so the user can spot a mismatch
        assert b"attacker.atlassian.net" in response.content
        assert b"Install Jira integration" in response.content
        # assert a simple click doesn't immediately install it
        assert not Integration.objects.filter(provider="jira").exists()
        assert not OrganizationIntegration.objects.filter(
            organization_id=self.organization.id
        ).exists()

    @with_feature("organizations:jira-confirm-installation")
    def test_post_with_csrf_token_runs_pipeline(self) -> None:
        self.login_as(self.user)
        signed = _build_signed_params(external_id="legit.atlassian.net")

        response = self.client.post(
            f"{CONFIGURE_URL}?signed_params={signed}&orgSlug={self.organization.slug}"
        )

        # pipeline finishes because it was the post request, not just get (which shows the confirmation modal)
        assert response.status_code == 302
        assert Integration.objects.filter(
            provider="jira", external_id="legit.atlassian.net"
        ).exists()
        assert OrganizationIntegration.objects.filter(
            organization_id=self.organization.id,
            integration__provider="jira",
        ).exists()

    def test_get_without_flag_runs_pipeline_directly(self) -> None:
        self.login_as(self.user)
        signed = _build_signed_params(external_id="legit.atlassian.net")

        response = self.client.get(
            f"{CONFIGURE_URL}?signed_params={signed}&orgSlug={self.organization.slug}"
        )

        # without the feature flag, GET installs immediately (legacy behavior)
        assert response.status_code == 302
        assert Integration.objects.filter(
            provider="jira", external_id="legit.atlassian.net"
        ).exists()
