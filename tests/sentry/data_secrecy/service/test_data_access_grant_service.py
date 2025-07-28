from datetime import datetime, timedelta, timezone

from sentry.data_secrecy.models.data_access_grant import DataAccessGrant
from sentry.data_secrecy.service.service import data_access_grant_service
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import all_silo_test, create_test_regions


@all_silo_test(regions=create_test_regions("us"))
@freeze_time("2025-07-08 00:00:00")
class TestDataAccessGrantService(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization()
        self.organization_2 = self.create_organization()

    def test_get_effective_waiver_status_with_active_grant(self) -> None:
        now = datetime.now(tz=timezone.utc)
        grant_start = now - timedelta(hours=1)
        grant_end = now + timedelta(hours=1)

        self.create_data_access_grant(
            organization_id=self.organization.id,
            grant_type=DataAccessGrant.GrantType.ZENDESK,
            ticket_id="TICKET-123",
            grant_start=grant_start,
            grant_end=grant_end,
        )

        result = data_access_grant_service.get_effective_grant_status(
            organization_id=self.organization.id
        )

        assert result is not None
        assert result.organization_id == self.organization.id
        assert result.access_start == grant_start
        assert result.access_end == grant_end

    def test_get_effective_waiver_status_with_no_grants(self) -> None:
        result = data_access_grant_service.get_effective_grant_status(
            organization_id=self.organization.id
        )
        assert result is None

    def test_get_effective_waiver_status_with_expired_grant(self) -> None:
        now = datetime.now(tz=timezone.utc)
        grant_start = now - timedelta(hours=2)
        grant_end = now - timedelta(hours=1)  # Expired

        self.create_data_access_grant(
            organization_id=self.organization.id,
            grant_type=DataAccessGrant.GrantType.ZENDESK,
            ticket_id="TICKET-123",
            grant_start=grant_start,
            grant_end=grant_end,
        )

        result = data_access_grant_service.get_effective_grant_status(
            organization_id=self.organization.id
        )
        assert result is None

    def test_get_effective_waiver_status_with_future_grant(self) -> None:
        now = datetime.now(tz=timezone.utc)
        grant_start = now + timedelta(hours=1)  # Future
        grant_end = now + timedelta(hours=2)

        self.create_data_access_grant(
            organization_id=self.organization.id,
            grant_type=DataAccessGrant.GrantType.ZENDESK,
            ticket_id="TICKET-123",
            grant_start=grant_start,
            grant_end=grant_end,
        )

        result = data_access_grant_service.get_effective_grant_status(
            organization_id=self.organization.id
        )
        assert result is None

    def test_get_effective_waiver_status_with_revoked_grant(self) -> None:
        now = datetime.now(tz=timezone.utc)
        grant_start = now - timedelta(hours=1)
        grant_end = now + timedelta(hours=1)

        self.create_data_access_grant(
            organization_id=self.organization.id,
            grant_type=DataAccessGrant.GrantType.ZENDESK,
            ticket_id="TICKET-123",
            grant_start=grant_start,
            grant_end=grant_end,
            revocation_date=now,
            revocation_reason=DataAccessGrant.RevocationReason.MANUAL_REVOCATION,
        )

        result = data_access_grant_service.get_effective_grant_status(
            organization_id=self.organization.id
        )
        assert result is None

    def test_get_effective_waiver_status_with_multiple_grants(self) -> None:
        now = datetime.now(tz=timezone.utc)

        # Grant 1: Earlier start, earlier end
        grant1_start = now - timedelta(hours=2)
        grant1_end = now + timedelta(hours=1)

        # Grant 2: Later start, later end
        grant2_start = now - timedelta(hours=1)
        grant2_end = now + timedelta(hours=2)

        self.create_data_access_grant(
            organization_id=self.organization.id,
            grant_type=DataAccessGrant.GrantType.ZENDESK,
            ticket_id="TICKET-123",
            grant_start=grant1_start,
            grant_end=grant1_end,
        )
        self.create_data_access_grant(
            organization_id=self.organization.id,
            grant_type=DataAccessGrant.GrantType.MANUAL,
            granted_by_user=self.user,
            grant_start=grant2_start,
            grant_end=grant2_end,
        )

        result = data_access_grant_service.get_effective_grant_status(
            organization_id=self.organization.id
        )

        assert result is not None
        assert result.organization_id == self.organization.id
        # Should use earliest start and latest end
        assert result.access_start == grant1_start
        assert result.access_end == grant2_end
