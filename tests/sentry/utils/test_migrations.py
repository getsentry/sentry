from sentry.models.organization import Organization
from sentry.testutils.cases import TestCase
from sentry.utils.migrations import clear_flag


class ClearFlagTest(TestCase):
    def test_simple(self):
        org1 = self.create_organization(
            flags=Organization.flags.enhanced_privacy | Organization.flags.early_adopter
        )
        org2 = self.create_organization(flags=Organization.flags.early_adopter)
        org3 = self.create_organization(flags=0)

        clear_flag(Organization, "early_adopter")

        org1.refresh_from_db()
        assert not org1.flags.early_adopter
        assert org1.flags.enhanced_privacy
        assert org1.flags._value == 2

        org2.refresh_from_db()
        assert not org2.flags.early_adopter
        assert org2.flags._value == 0

        org3.refresh_from_db()
        assert not org3.flags.early_adopter
        assert org3.flags._value == 0
