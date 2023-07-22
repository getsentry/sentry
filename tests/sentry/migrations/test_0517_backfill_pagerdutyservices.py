from sentry.testutils.cases import TestMigrations


class BackfillPagerDutyServices(TestMigrations):
    migrate_from = "0516_switch_pagerduty_silo"
    migrate_to = "0517_backfill_pagerdutyservices_into_org_integrations"

    def setup_initial_state(self):
        Integration = self.apps.get_model("sentry", "Integration")
        Organization = self.apps.get_model("sentry", "Organization")
        OrganizationIntegration = self.apps.get_model("sentry", "OrganizationIntegration")
        PagerDutyServices = self.apps.get_model("sentry", "PagerDutyServices")

        org = Organization.objects.create(name="test", slug="test")
        int = Integration.objects.create(
            provider="pagerduty",
            name="Blah",
            external_id="TXXXXXXX1",
            metadata={},
        )

        self.org_int1 = org_int1 = OrganizationIntegration.objects.create(
            organization=org, integration=int
        )
        self.org_int2 = org_int2 = OrganizationIntegration.objects.create(
            organization=org, integration=int
        )

        PagerDutyServices.objects.create(
            organization_id=org.id,
            integration_id=int.id,
            organization_integration_id=org_int1.id,
            integration_key="key1",
            service_name="service1",
        )

        PagerDutyServices.objects.create(
            organization_id=org.id,
            integration_id=int.id,
            organization_integration_id=org_int2.id,
            integration_key="key2",
            service_name="service2",
        )

        PagerDutyServices.objects.create(
            organization_id=org.id,
            integration_id=int.id,
            organization_integration_id=org_int2.id,
            integration_key="key3",
            service_name="service3",
        )

        PagerDutyServices.objects.create(
            organization_id=org.id,
            integration_id=int.id,
            organization_integration_id=org_int2.id,
            integration_key="key4",
            service_name="service4",
        )

        org_int1.refresh_from_db()
        assert org_int1.config == {}

    def test_backfill(self):
        assert len(self.org_int1.config["pagerduty_services"]) == 1
        assert len(self.org_int1.config["pagerduty_services"]) == 3
