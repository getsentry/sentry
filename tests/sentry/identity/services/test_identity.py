from sentry.identity.services.identity import identity_service
from sentry.testutils.cases import TestCase


class GetIdentitiesFilterTest(TestCase):
    def test_filters_by_identity_ext_ids(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="slack",
            external_id="TXXXX",
        )
        idp = self.create_identity_provider(integration=integration)

        user_a = self.create_user()
        user_b = self.create_user()
        user_c = self.create_user()
        self.create_identity(user=user_a, identity_provider=idp, external_id="UA")
        self.create_identity(user=user_b, identity_provider=idp, external_id="UB")
        self.create_identity(user=user_c, identity_provider=idp, external_id="UC")

        identities = identity_service.get_identities(
            filter={"provider_id": idp.id, "identity_ext_ids": ["UA", "UC", "UNLINKED"]}
        )

        assert {i.external_id for i in identities} == {"UA", "UC"}
