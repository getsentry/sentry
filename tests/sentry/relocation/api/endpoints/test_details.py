from datetime import datetime, timezone
from uuid import uuid4

from sentry.relocation.models.relocation import Relocation
from sentry.relocation.utils import OrderedTask
from sentry.testutils.cases import APITestCase

TEST_DATE_ADDED = datetime(2023, 1, 23, 1, 23, 45, tzinfo=timezone.utc)
TEST_DATE_UPDATED = datetime(2023, 1, 23, 1, 24, 45, tzinfo=timezone.utc)


class GetRelocationDetailsTest(APITestCase):
    endpoint = "sentry-api-0-relocations-details"

    def setUp(self):
        super().setUp()
        self.owner = self.create_user(
            email="owner", is_superuser=False, is_staff=True, is_active=True
        )
        self.staff_user = self.create_user(is_staff=True)
        self.relocation: Relocation = Relocation.objects.create(
            date_added=TEST_DATE_ADDED,
            creator_id=self.staff_user.id,
            owner_id=self.owner.id,
            status=Relocation.Status.SUCCESS.value,
            step=Relocation.Step.COMPLETED.value,
            provenance=Relocation.Provenance.SELF_HOSTED.value,
            want_org_slugs=["foo"],
            want_usernames=["emily", "fred"],
            latest_notified=Relocation.EmailKind.SUCCEEDED.value,
            latest_unclaimed_emails_sent_at=TEST_DATE_UPDATED,
            latest_task=OrderedTask.COMPLETED.name,
            latest_task_attempts=1,
        )

    def test_good_staff_found(self):
        self.login_as(user=self.staff_user, staff=True)
        response = self.get_success_response(self.relocation.uuid, status_code=200)
        assert response.data["uuid"] == str(self.relocation.uuid)

    def test_bad_staff_not_found(self):
        self.login_as(user=self.staff_user, staff=True)
        does_not_exist_uuid = uuid4().hex
        self.get_error_response(str(does_not_exist_uuid), status_code=404)

    # TODO(getsentry/team-ospo#214): Add test for non-superusers to view their own relocations, but
    # not other owners'.
    def test_bad_no_auth(self):
        self.get_error_response(self.relocation.uuid, status_code=401)
