from sentry.models.authprovider import AuthProvider
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation_for_provider import (
    SentryAppInstallationForProvider,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class AuthProviderEnableScimTest(TestCase):
    def test_enable_scim_skips_existing_installation(self) -> None:
        auth_provider = AuthProvider.objects.create(
            organization_id=self.organization.id, provider="dummy"
        )
        auth_provider.enable_scim(self.user)
        auth_provider.save()

        # The flag can be cleared while the SCIM installation is left behind.
        auth_provider.flags.scim_enabled = False
        auth_provider.enable_scim(self.user)

        assert (
            SentryAppInstallationForProvider.objects.filter(
                organization_id=self.organization.id, provider="dummy_scim"
            ).count()
            == 1
        )
        assert SentryApp.objects.filter(owner_id=self.organization.id).count() == 1
