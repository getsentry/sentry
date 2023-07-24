from sentry.models import Integration, Organization, OrganizationIntegration, PagerDutyService
from sentry.testutils.cases import TestMigrations


class BackfillPagerDutyServices(TestMigrations):
    migrate_from = "0516_switch_pagerduty_silo"
    migrate_to = "0517_backfill_pagerdutyservices_into_org_integrations"

    def setup_initial_state(self):
        org = Organization.objects.create(name="test", slug="test")
        org2 = Organization.objects.create(name="test", slug="test2")
        int = Integration.objects.create(
            provider="pagerduty",
            name="Blah",
            external_id="TXXXXXXX1",
            metadata={},
        )
        int2 = Integration.objects.create(
            provider="pagerduty",
            name="Blah 2",
            external_id="TXXXXXXX2",
            metadata={},
        )

        self.org_int1 = org_int1 = OrganizationIntegration.objects.create(
            organization_id=org.id, integration=int
        )
        self.org_int2 = org_int2 = OrganizationIntegration.objects.create(
            organization_id=org2.id, integration=int2
        )

        PagerDutyService.objects.create(
            organization_id=org.id,
            integration_id=int.id,
            organization_integration_id=org_int1.id,
            integration_key="key1",
            service_name="service1",
        )

        PagerDutyService.objects.create(
            organization_id=org.id,
            integration_id=int.id,
            organization_integration_id=org_int2.id,
            integration_key="key2",
            service_name="service2",
        )

        PagerDutyService.objects.create(
            organization_id=org.id,
            integration_id=int.id,
            organization_integration_id=org_int2.id,
            integration_key="key3",
            service_name="service3",
        )

        PagerDutyService.objects.create(
            organization_id=org.id,
            integration_id=int.id,
            organization_integration_id=org_int2.id,
            integration_key="key4",
            service_name="service4",
        )

        org_int1.refresh_from_db()
        org_int1.config = {}
        org_int1.save()

        org_int2.refresh_from_db()
        org_int2.config = {}
        org_int2.save()

        assert org_int1.config == {}
        assert org_int2.config == {}

    def test_backfill(self):
        self.org_int1.refresh_from_db()
        self.org_int2.refresh_from_db()
        assert len(self.org_int1.config["pagerduty_services"]) == 1
        assert len(self.org_int2.config["pagerduty_services"]) == 3
