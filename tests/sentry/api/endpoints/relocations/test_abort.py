from datetime import datetime, timezone
from uuid import uuid4

from sentry.api.endpoints.relocations.abort import ERR_NOT_ABORTABLE_STATUS
from sentry.models.relocation import Relocation
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils.relocation import OrderedTask

TEST_DATE_ADDED = datetime(2023, 1, 23, 1, 23, 45, tzinfo=timezone.utc)


@region_silo_test
class AbortRelocationTest(APITestCase):
    endpoint = "sentry-api-0-relocations-abort"

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
            status=Relocation.Status.IN_PROGRESS.value,
            step=Relocation.Step.PREPROCESSING.value,
            want_org_slugs='["foo"]',
            want_usernames='["alice", "bob"]',
            latest_notified=Relocation.EmailKind.STARTED.value,
            latest_task=OrderedTask.PREPROCESSING_SCAN.name,
            latest_task_attempts=1,
        )

    def test_good_abort_in_progress(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.client.put(f"/api/0/relocations/{str(self.relocation.uuid)}/abort/")

        assert response.status_code == 200
        assert response.data["status"] == Relocation.Status.FAILURE.name
        assert response.data["step"] == Relocation.Step.PREPROCESSING.name

    def test_good_abort_paused(self):
        self.login_as(user=self.superuser, superuser=True)
        self.relocation.status = Relocation.Status.PAUSE.value
        self.relocation.save()
        response = self.client.put(f"/api/0/relocations/{str(self.relocation.uuid)}/abort/")

        assert response.status_code == 200
        assert response.data["status"] == Relocation.Status.FAILURE.name
        assert response.data["step"] == Relocation.Step.PREPROCESSING.name

    def test_bad_already_succeeded(self):
        self.login_as(user=self.superuser, superuser=True)
        self.relocation.status = Relocation.Status.SUCCESS.value
        self.relocation.save()
        response = self.client.put(f"/api/0/relocations/{str(self.relocation.uuid)}/abort/")

        assert response.status_code == 400
        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_NOT_ABORTABLE_STATUS

    def test_bad_already_failed(self):
        self.login_as(user=self.superuser, superuser=True)
        self.relocation.status = Relocation.Status.FAILURE.value
        self.relocation.save()
        response = self.client.put(f"/api/0/relocations/{str(self.relocation.uuid)}/abort/")

        assert response.status_code == 400
        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_NOT_ABORTABLE_STATUS

    def test_bad_not_found(self):
        self.login_as(user=self.superuser, superuser=True)
        does_not_exist_uuid = uuid4().hex
        response = self.client.put(f"/api/0/relocations/{str(does_not_exist_uuid)}/abort/")

        assert response.status_code == 404

    def test_bad_no_auth(self):
        response = self.client.put(f"/api/0/relocations/{str(self.relocation.uuid)}/abort/")

        assert response.status_code == 401

    def test_bad_no_superuser(self):
        self.login_as(user=self.superuser, superuser=False)
        response = self.client.put(f"/api/0/relocations/{str(self.relocation.uuid)}/abort/")

        assert response.status_code == 403
