from datetime import datetime, timedelta, timezone

from sentry.data_secrecy.models.datasecrecywaiver import DataSecrecyWaiver
from sentry.data_secrecy.service.service import data_secrecy_service
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode, create_test_regions


@all_silo_test(regions=create_test_regions("us"))
class TestDataSecrecyService(TestCase):
    def setUp(self):
        self.organization = self.create_organization()
        self.organization_2 = self.create_organization()
        self.access_start = datetime.now(tz=timezone.utc)
        self.access_end = datetime.now(tz=timezone.utc) + timedelta(days=1)
        self.zendesk_tickets = ["https://example.com/ticket1", "https://example.com/ticket2"]

    def test_get_data_secrecy_waiver(self):
        with assume_test_silo_mode(SiloMode.REGION):
            self.waiver = DataSecrecyWaiver.objects.create(
                organization_id=self.organization.id,
                access_start=self.access_start,
                access_end=self.access_end,
                zendesk_tickets=self.zendesk_tickets,
            )

        # Test retrieving an existing waiver
        result = data_secrecy_service.get_data_secrecy_waiver(organization_id=self.organization.id)
        assert result is not None
        assert result.organization_id == self.organization.id
        assert result.access_start == self.access_start
        assert result.access_end == self.access_end
        assert result.zendesk_tickets == self.zendesk_tickets

        # Test retrieving a non-existent waiver
        non_existent_result = data_secrecy_service.get_data_secrecy_waiver(
            organization_id=self.organization_2.id
        )
        assert non_existent_result is None

        # Test after deleting the waiver
        with assume_test_silo_mode(SiloMode.REGION):
            self.waiver.delete()
        deleted_result = data_secrecy_service.get_data_secrecy_waiver(
            organization_id=self.organization.id
        )
        assert deleted_result is None
