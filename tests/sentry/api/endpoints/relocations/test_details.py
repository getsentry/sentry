from datetime import datetime, timezone
from uuid import uuid4

from sentry.models.relocation import Relocation
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils.relocation import OrderedTask

TEST_DATE_ADDED = datetime(2023, 1, 23, 1, 23, 45, tzinfo=timezone.utc)
TEST_DATE_UPDATED = datetime(2023, 1, 23, 1, 24, 45, tzinfo=timezone.utc)


@region_silo_test
class GetRelocationDetailsTest(APITestCase):
    endpoint = "sentry-api-0-relocations-details"

    def setUp(self):
        super().setUp()
        self.owner = self.create_user(
            email="owner", is_superuser=False, is_staff=True, is_active=True
        )
        self.superuser = self.create_user(
            "superuser", is_superuser=True, is_staff=True, is_active=True
        )
        self.relocation: Relocation = Relocation.objects.create(
            date_added=TEST_DATE_ADDED,
            creator_id=self.superuser.id,
            owner_id=self.owner.id,
            status=Relocation.Status.SUCCESS.value,
            step=Relocation.Step.COMPLETED.value,
            want_org_slugs='["foo"]',
            want_usernames='["emily", "fred"]',
            latest_notified=Relocation.EmailKind.SUCCEEDED.value,
            latest_unclaimed_emails_sent_at=TEST_DATE_UPDATED,
            latest_task=OrderedTask.COMPLETED.name,
            latest_task_attempts=1,
        )

    def test_good_found(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.client.get(f"/api/0/relocations/{str(self.relocation.uuid)}/")

        assert response.status_code == 200
        assert response.data["uuid"] == str(self.relocation.uuid)

    def test_bad_not_found(self):
        self.login_as(user=self.superuser, superuser=True)
        does_not_exist_uuid = uuid4().hex
        response = self.client.get(f"/api/0/relocations/{str(does_not_exist_uuid)}/")

        assert response.status_code == 404

    # TODO(getsentry/team-ospo#214): Add test for non-superusers to view their own relocations, but
    # not other owners'.
    def test_bad_no_auth(self):
        response = self.client.get(f"/api/0/relocations/{str(self.relocation.uuid)}/")

        assert response.status_code == 401
