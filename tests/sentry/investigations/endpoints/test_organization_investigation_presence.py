from __future__ import annotations

from datetime import timedelta

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone

from sentry.investigations.models import InvestigationSeen
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.users.models.user import User

FEATURE = "organizations:investigations"


@with_feature(FEATURE)
class OrganizationInvestigationPresenceTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Investigation"
        )
        self.url = reverse(
            "sentry-api-0-organization-investigation-presence",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
            },
        )

    def member(self) -> User:
        user = self.create_user()
        self.create_member(organization=self.organization, user=user, role="member")
        return user

    def test_lists_active_viewers_most_recent_first(self) -> None:
        other = self.member()
        start = timezone.now().replace(microsecond=0)

        self.login_as(self.user)
        with freeze_time(start):
            response = self.client.put(self.url)
        assert response.status_code == 200
        assert response.data == {
            "viewers": [{"userId": str(self.user.id), "lastSeen": start, "active": True}],
            "heartbeatIntervalMs": 5000,
        }

        self.login_as(other)
        with freeze_time(start + timedelta(seconds=1)):
            response = self.client.put(self.url)
        assert [(v["userId"], v["active"]) for v in response.data["viewers"]] == [
            (str(other.id), True),
            (str(self.user.id), True),
        ]

    def test_lists_earlier_viewers_after_active_ones(self) -> None:
        earlier = self.member()
        earliest = self.member()
        now = timezone.now()
        self.create_investigation_seen(
            investigation=self.investigation, user=earliest, last_seen=now - timedelta(days=1)
        )
        self.create_investigation_seen(
            investigation=self.investigation, user=earlier, last_seen=now - timedelta(hours=1)
        )

        self.login_as(self.user)
        response = self.client.put(self.url)

        assert [(v["userId"], v["active"]) for v in response.data["viewers"]] == [
            (str(self.user.id), True),
            (str(earlier.id), False),
            (str(earliest.id), False),
        ]
        assert response.data["viewers"][1]["lastSeen"] == now - timedelta(hours=1)

    def test_records_seen_on_a_new_visit_and_during_a_long_one(self) -> None:
        self.login_as(self.user)
        start = timezone.now()

        with freeze_time(start):
            self.client.put(self.url)
        seen = InvestigationSeen.objects.get(investigation=self.investigation, user_id=self.user.id)
        assert seen.last_seen == start

        with freeze_time(start + timedelta(seconds=5)):
            self.client.put(self.url)
        seen.refresh_from_db()
        assert seen.last_seen == start

        # Still on the page, but the stored time is older than the refresh interval.
        refreshed = start + timedelta(minutes=5, seconds=5)
        for offset in range(20, 301, 15):
            with freeze_time(start + timedelta(seconds=offset)):
                self.client.put(self.url)
        with freeze_time(refreshed):
            self.client.put(self.url)
        seen.refresh_from_db()
        assert seen.last_seen == refreshed

    def test_reads_seen_rows_from_the_cache_between_writes(self) -> None:
        self.login_as(self.user)
        start = timezone.now()
        with freeze_time(start):
            self.client.put(self.url)

        with freeze_time(start + timedelta(seconds=5)):
            with CaptureQueriesContext(connection) as queries:
                self.client.put(self.url)

        assert not [q for q in queries.captured_queries if "investigationseen" in q["sql"]]

    def test_another_viewers_visit_updates_the_cached_list(self) -> None:
        other = self.member()
        start = timezone.now()
        self.login_as(self.user)
        with freeze_time(start):
            self.client.put(self.url)

        self.login_as(other)
        with freeze_time(start + timedelta(seconds=1)):
            self.client.put(self.url)
        self.login_as(self.user)
        with freeze_time(start + timedelta(minutes=2)):
            response = self.client.put(self.url)

        # The other viewer's presence has expired, so they are listed as an earlier viewer.
        assert [(v["userId"], v["active"]) for v in response.data["viewers"]] == [
            (str(self.user.id), True),
            (str(other.id), False),
        ]

    def test_other_organization_cannot_heartbeat(self) -> None:
        self.login_as(self.user)
        other_org = self.create_organization()
        url = reverse(
            "sentry-api-0-organization-investigation-presence",
            kwargs={
                "organization_id_or_slug": other_org.slug,
                "investigation_id": self.investigation.id,
            },
        )

        response = self.client.put(url)

        assert response.status_code in (403, 404)
