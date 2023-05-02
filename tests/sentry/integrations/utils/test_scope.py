from sentry.integrations.utils.scope import get_orgs_from_integration
from sentry.models.integrations.integration import Integration
from sentry.testutils import TestCase


class GetOrgsFromIntegrationTest(TestCase):
    def test_finds_single_org(self):
        org = self.create_organization(slug="dogsaregreat")
        integration = Integration.objects.create(name="squirrelChasers")
        integration.add_organization(org)

        found_orgs = get_orgs_from_integration(integration.id)

        assert found_orgs == [org]

    def test_finds_multiple_orgs(self):
        maisey_org = self.create_organization(slug="themaiseymaiseydog")
        charlie_org = self.create_organization(slug="charliebear")
        integration = Integration.objects.create(name="squirrelChasers")
        integration.add_organization(maisey_org)
        integration.add_organization(charlie_org)

        found_orgs = get_orgs_from_integration(integration.id)

        assert found_orgs == [maisey_org, charlie_org]

    def test_finds_no_orgs_without_erroring(self):
        integration = Integration.objects.create(name="squirrelChasers")

        found_orgs = get_orgs_from_integration(integration.id)

        assert found_orgs == []
