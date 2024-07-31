from sentry.organizations.services.organization import (
    RpcOrganization,
    RpcOrganizationMember,
    RpcUserOrganizationContext,
)
from sentry.superuser_access.prevent_superuser_access_backend import PreventSuperuserAccess
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test, create_test_regions


@all_silo_test(regions=create_test_regions("us"))
class DataSecrecyTest(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.organization.flags.prevent_superuser_access = True
        self.rpc_org = RpcOrganization(id=self.organization.id)
        self.rpc_org.flags.prevent_superuser_access = True

        self.rpc_orgmember = RpcOrganizationMember(
            organization_id=self.organization.id,
            role="admin",
            user_id=self.user.id,
        )
        self.rpc_context = RpcUserOrganizationContext(
            user_id=self.user.id, organization=self.rpc_org, member=self.rpc_orgmember
        )

        self.backend = PreventSuperuserAccess()

    def test_self_hosted(self):
        with self.settings(SENTRY_SELF_HOSTED=True):
            assert self.backend.should_allow_superuser_access(self.organization) is True
            assert self.backend.should_allow_superuser_access(self.rpc_context) is True

    def test_bit_flag_disabled(self):
        self.organization.flags.prevent_superuser_access = False
        assert self.backend.should_allow_superuser_access(self.organization) is True
        assert self.backend.should_allow_superuser_access(self.rpc_context) is True

    def test_returns_false(self):
        assert self.backend.should_allow_superuser_access(self.organization) is True
        assert self.backend.should_allow_superuser_access(self.rpc_context) is True
