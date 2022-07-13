from sentry.models import Integration
from sentry.testutils.cases import TestMigrations


class TestBackfill(TestMigrations):
    migrate_from = "0302_mep_backfill_and_not_null_snuba_query_type"
    migrate_to = "0303_backfill_msteams_default_installation_type"

    def setup_before_migration(self, apps):
        self.msteams_1 = Integration(
            provider="msteams",
            external_id="1",
            name="Team 1",
            metadata={
                "access_token": "abcde",
                "service_url": "https://smba.trafficmanager.net/amer/",
                "expires_at": 1594768808,
            },
        )
        self.msteams_1.save()
        self.msteams_2 = Integration(
            provider="msteams",
            external_id="2",
            name="Team 2",
            metadata={
                "access_token": "ghjkl",
                "service_url": "https://smba.trafficmanager.net/amer/",
                "expires_at": 1594768808,
                "installation_type": "tenant",
            },
        )
        self.msteams_2.save()

    def test(self):
        updated_integration = Integration.objects.get(id=self.msteams_1.id)
        assert updated_integration.metadata.get("installation_type") == "team"

        not_changed_integration = Integration.objects.get(id=self.msteams_2.id)
        assert not_changed_integration.metadata.get("installation_type") == "tenant"
