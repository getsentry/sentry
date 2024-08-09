from datetime import datetime, timezone

from sentry.data_secrecy.data_secrecy_logic import should_allow_superuser_access
from sentry.data_secrecy.models.datasecrecywaiver import DataSecrecyWaiver
from sentry.organizations.services.organization import (
    RpcOrganization,
    RpcOrganizationMember,
    RpcUserOrganizationContext,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode, create_test_regions


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

    def test_self_hosted(self):
        with self.settings(SENTRY_SELF_HOSTED=True):
            assert should_allow_superuser_access(self.organization) is True
            assert should_allow_superuser_access(self.rpc_context) is True

    def test_feature_flag_disabled(self):
        with self.settings(SENTRY_SELF_HOSTED=False):
            assert should_allow_superuser_access(self.organization) is True
            assert should_allow_superuser_access(self.rpc_context) is True

    def test_bit_flag_disabled(self):
        with self.settings(SENTRY_SELF_HOSTED=False):
            self.organization.flags.prevent_superuser_access = False
            assert should_allow_superuser_access(self.organization) is True
            assert should_allow_superuser_access(self.rpc_context) is True

    @with_feature("organizations:data-secrecy")
    def test_no_waiver_exists(self):
        with self.settings(SENTRY_SELF_HOSTED=False):
            assert should_allow_superuser_access(self.organization) is False
            assert should_allow_superuser_access(self.rpc_context) is False

    @freeze_time(datetime(2024, 7, 18, 0, 0, 0, tzinfo=timezone.utc))
    @with_feature("organizations:data-secrecy")
    def test_waiver_expired(self):
        with assume_test_silo_mode(SiloMode.REGION):
            DataSecrecyWaiver.objects.create(
                organization=self.organization,
                access_start=datetime(2024, 7, 17, 0, 0, 0, tzinfo=timezone.utc),
                access_end=datetime(2024, 7, 17, 23, 59, 59, tzinfo=timezone.utc),
            )
        with self.settings(SENTRY_SELF_HOSTED=False):
            assert should_allow_superuser_access(self.organization) is False
            assert should_allow_superuser_access(self.rpc_context) is False

    @freeze_time(datetime(2024, 7, 18, 0, 0, 0, tzinfo=timezone.utc))
    @with_feature("organizations:data-secrecy")
    def test_waiver_active(self):
        with assume_test_silo_mode(SiloMode.REGION):
            DataSecrecyWaiver.objects.create(
                organization=self.organization,
                access_start=datetime(2024, 7, 18, 0, 0, 0, tzinfo=timezone.utc),
                access_end=datetime(2024, 7, 19, 0, 0, 0, tzinfo=timezone.utc),
            )
        with self.settings(SENTRY_SELF_HOSTED=False):
            assert should_allow_superuser_access(self.organization) is True
            assert should_allow_superuser_access(self.rpc_context) is True
