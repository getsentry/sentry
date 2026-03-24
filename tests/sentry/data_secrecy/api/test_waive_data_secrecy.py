from datetime import datetime, timezone

from django.core.cache import cache
from rest_framework.response import Response

from sentry.data_secrecy.logic import data_access_grant_exists
from sentry.data_secrecy.models import DataAccessGrant
from sentry.data_secrecy.types import CACHE_KEY_PATTERN, EffectiveGrantStatus, GrantCacheStatus
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import control_silo_test


@freeze_time("2025-01-01 12:00:00")
@control_silo_test
class WaiveDataSecrecyTest(APITestCase):
    endpoint = "sentry-api-0-data-secrecy"

    def setUp(self) -> None:
        self.organization_id = self.organization.id
        self.cache_key = CACHE_KEY_PATTERN.format(organization_id=self.organization_id)
        self.current_time = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        self.access_start = datetime(2025, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
        self.access_end = datetime(2025, 1, 1, 14, 0, 0, tzinfo=timezone.utc)

        self.login_as(self.user)

        # Clear cache before each test
        cache.clear()

    def assert_response(
        self,
        response: Response,
        start: datetime | None = None,
        end: datetime | None = None,
        tickets: list[str] | None = None,
    ) -> None:
        data = response.data
        assert (
            data["accessStart"] == start.isoformat() if (start is not None) else self.access_start
        )
        assert data["accessEnd"] == end.isoformat() if (end is not None) else self.access_end
        if tickets is not None:
            assert data["zendeskTickets"] == tickets
        else:
            assert data["zendeskTickets"] == []

    def test_get_simple(self) -> None:
        cached_object = EffectiveGrantStatus(
            cache_status=GrantCacheStatus.VALID_WINDOW,
            access_end=self.access_end,
            access_start=self.access_start,
        )
        cache.set(self.cache_key, cached_object, timeout=300)

        response = self.get_success_response(self.organization.slug)
        self.assert_response(response)

    def test_get_simple__no_cached_entry(self) -> None:
        self.create_data_access_grant(
            organization_id=self.organization.id,
            grant_start=self.access_start,
            grant_end=self.access_end,
        )

        response = self.get_success_response(self.organization.slug)
        self.assert_response(response)

    def test_get_with_tickets(self) -> None:
        self.create_data_access_grant(
            organization_id=self.organization.id,
            grant_start=self.access_start,
            grant_end=self.access_end,
            ticket_id="1234",
            grant_type=DataAccessGrant.GrantType.ZENDESK,
        )
        response = self.get_success_response(self.organization.slug)
        self.assert_response(response, tickets=["1234"])

    def test_get_no_waiver(self) -> None:
        response = self.get_error_response(self.organization.slug, status_code=404)
        assert response.data["detail"] == "No data secrecy waiver in place."

    def test_post(self) -> None:
        self.get_success_response(
            self.organization.slug, method="post", access_end=self.access_end, status_code=201
        )

        created_grant = DataAccessGrant.objects.first()
        assert created_grant is not None
        assert created_grant.grant_start == self.current_time
        assert created_grant.grant_end == self.access_end
        assert created_grant.grant_type == DataAccessGrant.GrantType.MANUAL

    def test_post_invalid_grant_end(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            method="post",
            access_end=datetime(2025, 1, 1, 9, 0, 0, tzinfo=timezone.utc),
        )
        assert (
            response.data["access_end"][0]
            == "Invalid timestamp (access_end must be in the future)."
        )

    def test_delete(self) -> None:
        grant = self.create_data_access_grant(
            organization_id=self.organization.id,
            grant_type=DataAccessGrant.GrantType.MANUAL,
            grant_start=self.access_start,
            grant_end=self.access_end,
        )

        # Hit the database and cache the result
        result1 = data_access_grant_exists(self.organization.id)
        assert result1 is True
        assert cache.get(self.cache_key) is not None

        self.get_success_response(self.organization.slug, method="delete", status_code=204)

        grant.refresh_from_db()
        assert grant.revocation_date == self.current_time
        assert grant.revocation_reason == DataAccessGrant.RevocationReason.MANUAL_REVOCATION
        assert grant.revoked_by_user_id == self.user.id

        # Confirm that we invalidated the cache
        assert cache.get(self.cache_key) is None
