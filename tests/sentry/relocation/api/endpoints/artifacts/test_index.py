from datetime import datetime, timezone
from io import StringIO
from uuid import uuid4

from sentry.models.files.utils import get_relocation_storage
from sentry.relocation.api.endpoints.artifacts.index import ERR_NEED_RELOCATION_ADMIN
from sentry.relocation.models.relocation import Relocation
from sentry.relocation.utils import OrderedTask
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options

TEST_DATE_ADDED = datetime(2023, 1, 23, 1, 23, 45, tzinfo=timezone.utc)
RELOCATION_ADMIN_PERMISSION = "relocation.admin"


class GetRelocationArtifactsTest(APITestCase):
    endpoint = "sentry-api-0-relocations-artifacts-index"
    method = "GET"

    def setUp(self):
        super().setUp()
        self.owner = self.create_user(email="owner@example.com", is_superuser=False, is_staff=False)
        self.superuser = self.create_user(is_superuser=True)
        self.staff_user = self.create_user(is_staff=True)
        self.relocation: Relocation = Relocation.objects.create(
            date_added=TEST_DATE_ADDED,
            creator_id=self.owner.id,
            owner_id=self.owner.id,
            status=Relocation.Status.PAUSE.value,
            step=Relocation.Step.PREPROCESSING.value,
            want_org_slugs=["foo"],
            want_usernames=["alice", "bob"],
            latest_notified=Relocation.EmailKind.STARTED.value,
            latest_task=OrderedTask.PREPROCESSING_SCAN.name,
            latest_task_attempts=1,
        )


class GetRelocationArtifactsGoodTest(GetRelocationArtifactsTest):
    def setUp(self):
        super().setUp()
        dir = f"runs/{self.relocation.uuid}"
        self.relocation_storage = get_relocation_storage()

        # We only care about file sizes for this API.
        self.relocation_storage.save(f"{dir}/conf/cloudbuild.yaml", StringIO("1"))
        self.relocation_storage.save(f"{dir}/conf/cloudbuild.zip", StringIO("12"))
        self.relocation_storage.save(
            f"{dir}/findings/compare-baseline-config.json", StringIO("123")
        )
        self.relocation_storage.save(
            f"{dir}/findings/compare-colliding-users.json", StringIO("1234")
        )
        self.relocation_storage.save(
            f"{dir}/findings/export-baseline-config.json", StringIO("12345")
        )
        self.relocation_storage.save(
            f"{dir}/findings/export-colliding-users.json", StringIO("123456")
        )
        self.relocation_storage.save(
            f"{dir}/findings/import-baseline-config.json", StringIO("1234567")
        )
        self.relocation_storage.save(
            f"{dir}/findings/import-colliding-users.json", StringIO("12345678")
        )
        self.relocation_storage.save(
            f"{dir}/findings/import-raw-relocation-data.json", StringIO("123456789")
        )
        self.relocation_storage.save(f"{dir}/in/kms-config.json", StringIO("1234567890"))
        self.relocation_storage.save(f"{dir}/in/baseline-config.tar", StringIO("1234567890a"))
        self.relocation_storage.save(f"{dir}/in/colliding-users.tar", StringIO("1234567890ab"))
        self.relocation_storage.save(f"{dir}/in/raw-relocation-data.tar", StringIO("1234567890abc"))
        self.relocation_storage.save(f"{dir}/out/baseline-config.tar", StringIO("1234567890abcd"))
        self.relocation_storage.save(f"{dir}/out/colliding-users.tar", StringIO("1234567890abcde"))

    def test_good_with_superuser(self):
        self.add_user_permission(self.superuser, RELOCATION_ADMIN_PERMISSION)
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_success_response(str(self.relocation.uuid))

        assert len(response.data["files"]) == 15
        for file_info in response.data["files"]:
            file_name = f"runs/{self.relocation.uuid}/{file_info['path']}"
            file_size = file_info["bytes"]
            assert self.relocation_storage.size(file_name) == file_size

    @override_options({"staff.ga-rollout": True})
    def test_good_with_staff(self):
        self.add_user_permission(self.staff_user, RELOCATION_ADMIN_PERMISSION)
        self.login_as(user=self.staff_user, staff=True)
        self.get_success_response(str(self.relocation.uuid))
        response = self.get_success_response(str(self.relocation.uuid))

        assert len(response.data["files"]) == 15
        for file_info in response.data["files"]:
            file_name = f"runs/{self.relocation.uuid}/{file_info['path']}"
            file_size = file_info["bytes"]
            assert self.relocation_storage.size(file_name) == file_size


class GetRelocationArtifactsBadTest(GetRelocationArtifactsTest):
    @override_options({"staff.ga-rollout": True})
    def test_bad_unprivileged_user(self):
        self.login_as(user=self.owner, superuser=False, staff=False)

        # Ensures we don't reveal existence info to improperly authenticated users.
        does_not_exist_uuid = uuid4().hex
        self.get_error_response(str(does_not_exist_uuid), status_code=403)
        self.get_error_response(str(self.relocation.uuid), status_code=403)

    def test_bad_superuser_disabled(self):
        self.add_user_permission(self.superuser, RELOCATION_ADMIN_PERMISSION)
        self.login_as(user=self.superuser, superuser=False)

        # Ensures we don't reveal existence info to improperly authenticated users.
        does_not_exist_uuid = uuid4().hex
        self.get_error_response(str(does_not_exist_uuid), status_code=403)
        self.get_error_response(str(self.relocation.uuid), status_code=403)

    @override_options({"staff.ga-rollout": True})
    def test_bad_staff_disabled(self):
        self.add_user_permission(self.staff_user, RELOCATION_ADMIN_PERMISSION)
        self.login_as(user=self.staff_user, staff=False)

        # Ensures we don't reveal existence info to improperly authenticated users.
        does_not_exist_uuid = uuid4().hex
        self.get_error_response(str(does_not_exist_uuid), status_code=403)
        self.get_error_response(str(self.relocation.uuid), status_code=403)

    def test_bad_has_superuser_but_no_relocation_admin_permission(self):
        self.login_as(user=self.superuser, superuser=True)

        # Ensures we don't reveal existence info to improperly authenticated users.
        does_not_exist_uuid = uuid4().hex
        response = self.get_error_response(str(does_not_exist_uuid), status_code=403)

        assert response.data.get("detail") == ERR_NEED_RELOCATION_ADMIN

        response = self.get_error_response(str(self.relocation.uuid), status_code=403)

        assert response.data.get("detail") == ERR_NEED_RELOCATION_ADMIN

    @override_options({"staff.ga-rollout": True})
    def test_bad_has_staff_but_no_relocation_admin_permission(self):
        self.login_as(user=self.staff_user, staff=True)

        # Ensures we don't reveal existence info to improperly authenticated users.
        does_not_exist_uuid = uuid4().hex
        response = self.get_error_response(str(does_not_exist_uuid), status_code=403)

        assert response.data.get("detail") == ERR_NEED_RELOCATION_ADMIN

        response = self.get_error_response(str(self.relocation.uuid), status_code=403)

        assert response.data.get("detail") == ERR_NEED_RELOCATION_ADMIN

    @override_options({"staff.ga-rollout": True})
    def test_bad_relocation_not_found(self):
        self.add_user_permission(self.staff_user, RELOCATION_ADMIN_PERMISSION)
        self.login_as(user=self.staff_user, staff=True)
        does_not_exist_uuid = uuid4().hex
        self.get_error_response(str(does_not_exist_uuid), status_code=404)
