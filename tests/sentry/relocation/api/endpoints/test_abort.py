from datetime import datetime, timezone
from uuid import uuid4

from sentry.relocation.api.endpoints.abort import ERR_NOT_ABORTABLE_STATUS
from sentry.relocation.models.relocation import Relocation
from sentry.relocation.utils import OrderedTask
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options

TEST_DATE_ADDED = datetime(2023, 1, 23, 1, 23, 45, tzinfo=timezone.utc)


class AbortRelocationTest(APITestCase):
    endpoint = "sentry-api-0-relocations-abort"
    method = "put"

    def setUp(self):
        super().setUp()
        self.owner = self.create_user(
            email="owner", is_superuser=False, is_staff=True, is_active=True
        )
        self.superuser = self.create_user(is_superuser=True)
        self.staff_user = self.create_user(is_staff=True)
        self.relocation: Relocation = Relocation.objects.create(
            date_added=TEST_DATE_ADDED,
            creator_id=self.superuser.id,
            owner_id=self.owner.id,
            status=Relocation.Status.IN_PROGRESS.value,
            step=Relocation.Step.PREPROCESSING.value,
            provenance=Relocation.Provenance.SELF_HOSTED.value,
            want_org_slugs=["foo"],
            want_usernames=["alice", "bob"],
            latest_notified=Relocation.EmailKind.STARTED.value,
            latest_task=OrderedTask.PREPROCESSING_SCAN.name,
            latest_task_attempts=1,
        )

    @override_options({"staff.ga-rollout": True})
    def test_good_staff_abort_in_progress(self):
        self.login_as(user=self.staff_user, staff=True)
        self.relocation.status = Relocation.Status.PAUSE.value
        self.relocation.save()
        response = self.get_success_response(self.relocation.uuid, status_code=200)

        assert response.data["status"] == Relocation.Status.FAILURE.name
        assert response.data["step"] == Relocation.Step.PREPROCESSING.name

    def test_good_superuser_abort_in_progress(self):
        self.login_as(user=self.superuser, superuser=True)
        self.relocation.status = Relocation.Status.PAUSE.value
        self.relocation.save()
        response = self.get_success_response(self.relocation.uuid, status_code=200)

        assert response.data["status"] == Relocation.Status.FAILURE.name
        assert response.data["step"] == Relocation.Step.PREPROCESSING.name

    @override_options({"staff.ga-rollout": True})
    def test_good_staff_abort_paused(self):
        self.login_as(user=self.staff_user, staff=True)
        self.relocation.status = Relocation.Status.PAUSE.value
        self.relocation.save()
        response = self.get_success_response(self.relocation.uuid, status_code=200)

        assert response.data["status"] == Relocation.Status.FAILURE.name
        assert response.data["step"] == Relocation.Step.PREPROCESSING.name

    def test_good_superuser_abort_paused(self):
        self.login_as(user=self.superuser, superuser=True)
        self.relocation.status = Relocation.Status.PAUSE.value
        self.relocation.save()
        response = self.get_success_response(self.relocation.uuid, status_code=200)

        assert response.data["status"] == Relocation.Status.FAILURE.name
        assert response.data["step"] == Relocation.Step.PREPROCESSING.name

    @override_options({"staff.ga-rollout": True})
    def test_bad_staff_already_succeeded(self):
        self.login_as(user=self.staff_user, staff=True)
        self.relocation.status = Relocation.Status.SUCCESS.value
        self.relocation.save()
        response = self.get_error_response(self.relocation.uuid, status_code=400)

        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_NOT_ABORTABLE_STATUS

    def test_bad_superuser_already_succeeded(self):
        self.login_as(user=self.superuser, superuser=True)
        self.relocation.status = Relocation.Status.SUCCESS.value
        self.relocation.save()
        response = self.get_error_response(self.relocation.uuid, status_code=400)

        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_NOT_ABORTABLE_STATUS

    @override_options({"staff.ga-rollout": True})
    def test_bad_staff_already_failed(self):
        self.login_as(user=self.staff_user, staff=True)
        self.relocation.status = Relocation.Status.FAILURE.value
        self.relocation.save()
        response = self.get_error_response(self.relocation.uuid, status_code=400)

        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_NOT_ABORTABLE_STATUS

    def test_bad_superuser_already_failed(self):
        self.login_as(user=self.superuser, superuser=True)
        self.relocation.status = Relocation.Status.FAILURE.value
        self.relocation.save()
        response = self.get_error_response(self.relocation.uuid, status_code=400)

        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_NOT_ABORTABLE_STATUS

    @override_options({"staff.ga-rollout": True})
    def test_bad_staff_not_found(self):
        self.login_as(user=self.staff_user, staff=True)
        does_not_exist_uuid = uuid4().hex
        self.get_error_response(str(does_not_exist_uuid), status_code=404)

    def test_bad_superuser_not_found(self):
        self.login_as(user=self.superuser, superuser=True)
        does_not_exist_uuid = uuid4().hex
        self.get_error_response(str(does_not_exist_uuid), status_code=404)

    @override_options({"staff.ga-rollout": True})
    def test_superuser_fails_with_option(self):
        self.login_as(user=self.superuser, superuser=True)
        self.get_error_response(self.relocation.uuid, status_code=403)

    def test_bad_no_auth(self):
        self.get_error_response(self.relocation.uuid, status_code=401)

    def test_bad_no_superuser(self):
        self.login_as(user=self.superuser, superuser=False)
        self.get_error_response(self.relocation.uuid, status_code=403)
