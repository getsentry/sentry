from sentry.testutils.cases import TestCase


class InvestigationTest(TestCase):
    def test_get_absolute_url(self) -> None:
        organization = self.create_organization(slug="org1")
        investigation = self.create_investigation(organization=organization)

        assert (
            investigation.get_absolute_url()
            == f"http://testserver/organizations/org1/explore/investigations/{investigation.id}/"
        )
