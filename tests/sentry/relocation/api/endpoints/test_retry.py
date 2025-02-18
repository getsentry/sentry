from datetime import datetime, timezone
from functools import lru_cache
from io import BytesIO
from unittest.mock import Mock, patch
from uuid import uuid4

import orjson

from sentry.backup.crypto import LocalFileEncryptor, create_encrypted_export_tarball
from sentry.models.files.file import File
from sentry.relocation.api.endpoints import ERR_FEATURE_DISABLED
from sentry.relocation.api.endpoints.index import ERR_DUPLICATE_RELOCATION, ERR_THROTTLED_RELOCATION
from sentry.relocation.api.endpoints.retry import (
    ERR_FILE_NO_LONGER_EXISTS,
    ERR_NOT_RETRYABLE_STATUS,
    ERR_OWNER_NO_LONGER_EXISTS,
)
from sentry.relocation.models.relocation import Relocation, RelocationFile
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.helpers.backups import generate_rsa_key_pair
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import assume_test_silo_mode
from sentry.users.models.user import User
from sentry.utils.relocation import RELOCATION_FILE_TYPE, OrderedTask

FRESH_INSTALL_PATH = get_fixture_path("backup", "fresh-install.json")
TEST_DATE_ADDED = datetime(2023, 1, 23, 1, 23, 45, tzinfo=timezone.utc)


# No arguments, so we lazily cache the result after the first calculation.
@lru_cache(maxsize=1)
def get_test_tarball() -> BytesIO:
    (_, pub_key_pem) = generate_rsa_key_pair()
    with open(FRESH_INSTALL_PATH, "rb") as f:
        data = orjson.loads(f.read())
        return create_encrypted_export_tarball(data, LocalFileEncryptor(BytesIO(pub_key_pem)))


@patch("sentry.analytics.record")
class RetryRelocationTest(APITestCase):
    endpoint = "sentry-api-0-relocations-retry"
    method = "POST"

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
            status=Relocation.Status.FAILURE.value,
            step=Relocation.Step.PREPROCESSING.value,
            provenance=Relocation.Provenance.SELF_HOSTED.value,
            want_org_slugs=["foo", "bar"],
            want_usernames=["alice", "bob"],
            scheduled_pause_at_step=Relocation.Step.IMPORTING.value,
            scheduled_cancel_at_step=Relocation.Step.NOTIFYING.value,
            latest_notified=Relocation.EmailKind.FAILED.value,
            latest_task=OrderedTask.PREPROCESSING_SCAN.name,
            latest_task_attempts=1,
        )

        # Make two files - one to be referenced by our existing `Relocation`, the other not.
        self.file: File = File.objects.create(
            name="raw-relocation-data.tar", type=RELOCATION_FILE_TYPE
        )
        self.file.putfile(get_test_tarball())
        other_file: File = File.objects.create(
            name="raw-relocation-data.tar", type=RELOCATION_FILE_TYPE
        )
        other_file.putfile(get_test_tarball())

        self.relocation_file = RelocationFile.objects.create(
            relocation=self.relocation,
            file=self.file,
            kind=RelocationFile.Kind.RAW_USER_DATA.value,
        )

    @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 2})
    @patch("sentry.relocation.tasks.uploading_start.delay")
    def test_good_simple(self, uploading_start_mock: Mock, analytics_record_mock: Mock):
        self.login_as(user=self.owner, superuser=False)
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()
        file_count = File.objects.count()

        response = self.get_success_response(self.relocation.uuid, status_code=201)

        assert response.data["uuid"] != self.relocation.uuid
        assert self.relocation.date_added is not None
        assert response.data["dateAdded"] > self.relocation.date_added
        assert response.data["dateUpdated"] > self.relocation.date_updated
        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.UPLOADING.name
        assert response.data["wantOrgSlugs"] == self.relocation.want_org_slugs
        assert response.data["creator"]["id"] == str(self.owner.id)
        assert response.data["creator"]["email"] == str(self.owner.email)
        assert response.data["creator"]["username"] == str(self.owner.username)
        assert response.data["owner"]["id"] == str(self.owner.id)
        assert response.data["owner"]["email"] == str(self.owner.email)
        assert response.data["owner"]["username"] == str(self.owner.username)
        assert response.data["latestNotified"] is None
        assert response.data["latestUnclaimedEmailsSentAt"] is None
        assert response.data["scheduledPauseAtStep"] is None
        assert response.data["wantUsernames"] is None
        assert response.data["importedUserIds"] == []
        assert response.data["importedOrgIds"] == []

        assert (
            Relocation.objects.filter(owner_id=self.owner.id)
            .exclude(uuid=self.relocation.uuid)
            .exists()
        )
        assert Relocation.objects.count() == relocation_count + 1
        assert RelocationFile.objects.count() == relocation_file_count + 1
        assert File.objects.count() == file_count

        assert uploading_start_mock.call_count == 1

        analytics_record_mock.assert_called_with(
            "relocation.created",
            creator_id=int(response.data["creator"]["id"]),
            owner_id=int(response.data["owner"]["id"]),
            uuid=response.data["uuid"],
        )

    @override_options(
        {"relocation.enabled": False, "relocation.daily-limit.small": 2, "staff.ga-rollout": True}
    )
    @patch("sentry.relocation.tasks.uploading_start.delay")
    def test_good_staff_when_feature_disabled(
        self, uploading_start_mock: Mock, analytics_record_mock: Mock
    ):
        self.login_as(user=self.staff_user, staff=True)
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()
        file_count = File.objects.count()

        response = self.get_success_response(self.relocation.uuid, status_code=201)

        assert response.data["uuid"] != self.relocation.uuid
        assert response.data["creator"]["id"] == str(self.staff_user.id)
        assert response.data["creator"]["email"] == str(self.staff_user.email)
        assert response.data["creator"]["username"] == str(self.staff_user.username)
        assert response.data["owner"]["id"] == str(self.owner.id)
        assert response.data["owner"]["email"] == str(self.owner.email)
        assert response.data["owner"]["username"] == str(self.owner.username)

        assert (
            Relocation.objects.filter(owner_id=self.owner.id)
            .exclude(uuid=self.relocation.uuid)
            .exists()
        )
        assert Relocation.objects.count() == relocation_count + 1
        assert RelocationFile.objects.count() == relocation_file_count + 1
        assert File.objects.count() == file_count

        assert uploading_start_mock.call_count == 1

        analytics_record_mock.assert_called_with(
            "relocation.created",
            creator_id=int(response.data["creator"]["id"]),
            owner_id=int(response.data["owner"]["id"]),
            uuid=response.data["uuid"],
        )

    @override_options({"relocation.enabled": False, "relocation.daily-limit.small": 2})
    @patch("sentry.relocation.tasks.uploading_start.delay")
    def test_good_superuser_when_feature_disabled(
        self, uploading_start_mock: Mock, analytics_record_mock: Mock
    ):
        self.login_as(user=self.superuser, superuser=True)
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()
        file_count = File.objects.count()

        response = self.get_success_response(self.relocation.uuid, status_code=201)

        assert response.data["uuid"] != self.relocation.uuid
        assert response.data["creator"]["id"] == str(self.superuser.id)
        assert response.data["creator"]["email"] == str(self.superuser.email)
        assert response.data["creator"]["username"] == str(self.superuser.username)
        assert response.data["owner"]["id"] == str(self.owner.id)
        assert response.data["owner"]["email"] == str(self.owner.email)
        assert response.data["owner"]["username"] == str(self.owner.username)

        assert (
            Relocation.objects.filter(owner_id=self.owner.id)
            .exclude(uuid=self.relocation.uuid)
            .exists()
        )
        assert Relocation.objects.count() == relocation_count + 1
        assert RelocationFile.objects.count() == relocation_file_count + 1
        assert File.objects.count() == file_count

        assert uploading_start_mock.call_count == 1

        analytics_record_mock.assert_called_with(
            "relocation.created",
            creator_id=int(response.data["creator"]["id"]),
            owner_id=int(response.data["owner"]["id"]),
            uuid=response.data["uuid"],
        )

    @override_options({"relocation.enabled": False, "relocation.daily-limit.small": 2})
    @patch("sentry.relocation.tasks.uploading_start.delay")
    def test_bad_without_superuser_when_feature_disabled(
        self, uploading_start_mock: Mock, analytics_record_mock: Mock
    ):
        self.login_as(user=self.owner, superuser=False)
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()
        file_count = File.objects.count()

        response = self.get_error_response(self.relocation.uuid, status_code=403)

        assert response.data.get("detail") == ERR_FEATURE_DISABLED

        assert not (
            Relocation.objects.filter(owner_id=self.owner.id)
            .exclude(uuid=self.relocation.uuid)
            .exists()
        )
        assert Relocation.objects.count() == relocation_count
        assert RelocationFile.objects.count() == relocation_file_count
        assert File.objects.count() == file_count

        assert uploading_start_mock.call_count == 0

    @override_options({"relocation.enabled": False, "relocation.daily-limit.small": 2})
    @patch("sentry.relocation.tasks.uploading_start.delay")
    def test_bad_expired_superuser_when_feature_disabled(
        self, uploading_start_mock: Mock, analytics_record_mock: Mock
    ):
        self.login_as(user=self.owner, superuser=True)
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()
        file_count = File.objects.count()

        response = self.get_error_response(self.relocation.uuid, status_code=403)

        assert response.data.get("detail") == ERR_FEATURE_DISABLED

        assert not (
            Relocation.objects.filter(owner_id=self.owner.id)
            .exclude(uuid=self.relocation.uuid)
            .exists()
        )
        assert Relocation.objects.count() == relocation_count
        assert RelocationFile.objects.count() == relocation_file_count
        assert File.objects.count() == file_count

        assert uploading_start_mock.call_count == 0
        analytics_record_mock.assert_not_called()

    @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 2})
    @patch("sentry.relocation.tasks.uploading_start.delay")
    def test_bad_relocation_not_found(
        self, uploading_start_mock: Mock, analytics_record_mock: Mock
    ):
        self.login_as(user=self.owner, superuser=False)

        self.get_error_response(str(uuid4().hex), status_code=404)

        assert uploading_start_mock.call_count == 0
        analytics_record_mock.assert_not_called()

    @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 2})
    @patch("sentry.relocation.tasks.uploading_start.delay")
    def test_bad_relocation_file_not_found(
        self, uploading_start_mock: Mock, analytics_record_mock: Mock
    ):
        self.login_as(user=self.owner, superuser=False)
        RelocationFile.objects.all().delete()

        response = self.get_error_response(self.relocation.uuid, status_code=400)

        assert response.data.get("detail") == ERR_FILE_NO_LONGER_EXISTS
        assert uploading_start_mock.call_count == 0
        analytics_record_mock.assert_not_called()

    @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 2})
    @patch("sentry.relocation.tasks.uploading_start.delay")
    def test_bad_file_not_found(self, uploading_start_mock: Mock, analytics_record_mock: Mock):
        self.login_as(user=self.owner, superuser=False)
        File.objects.all().delete()

        response = self.get_error_response(self.relocation.uuid, status_code=400)

        assert response.data.get("detail") == ERR_FILE_NO_LONGER_EXISTS
        assert uploading_start_mock.call_count == 0

    @override_options(
        {"relocation.enabled": True, "relocation.daily-limit.small": 2, "staff.ga-rollout": True}
    )
    @patch("sentry.relocation.tasks.uploading_start.delay")
    def test_bad_staff_owner_not_found(
        self, uploading_start_mock: Mock, analytics_record_mock: Mock
    ):
        self.login_as(user=self.staff_user, staff=True)
        with assume_test_silo_mode(SiloMode.CONTROL):
            User.objects.filter(id=self.owner.id).delete()

        response = self.get_error_response(self.relocation.uuid, status_code=400)

        assert response.data.get("detail") == ERR_OWNER_NO_LONGER_EXISTS
        assert uploading_start_mock.call_count == 0
        analytics_record_mock.assert_not_called()

    @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 2})
    @patch("sentry.relocation.tasks.uploading_start.delay")
    def test_bad_superuser_owner_not_found(
        self, uploading_start_mock: Mock, analytics_record_mock: Mock
    ):
        self.login_as(user=self.superuser, superuser=True)
        with assume_test_silo_mode(SiloMode.CONTROL):
            User.objects.filter(id=self.owner.id).delete()

        response = self.get_error_response(self.relocation.uuid, status_code=400)

        assert response.data.get("detail") == ERR_OWNER_NO_LONGER_EXISTS
        assert uploading_start_mock.call_count == 0
        analytics_record_mock.assert_not_called()

    @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 1})
    @patch("sentry.relocation.tasks.uploading_start.delay")
    def test_bad_throttled(self, uploading_start_mock: Mock, analytics_record_mock: Mock):
        self.login_as(user=self.owner, superuser=False)

        response = self.get_error_response(self.relocation.uuid, status_code=429)

        assert response.data.get("detail") == ERR_THROTTLED_RELOCATION
        assert uploading_start_mock.call_count == 0
        analytics_record_mock.assert_not_called()

    for stat in [
        Relocation.Status.IN_PROGRESS,
        Relocation.Status.PAUSE,
    ]:

        @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 2})
        @patch("sentry.relocation.tasks.uploading_start.delay")
        def test_bad_relocation_still_ongoing(
            self, uploading_start_mock: Mock, analytics_record_mock: Mock, stat=stat
        ):
            self.login_as(user=self.owner, superuser=False)
            self.relocation.status = stat.value
            self.relocation.latest_notified = Relocation.EmailKind.STARTED.value
            self.relocation.save()

            response = self.get_error_response(self.relocation.uuid, status_code=400)

            assert response.data.get("detail") == ERR_NOT_RETRYABLE_STATUS.substitute(
                status=stat.name
            )
            assert uploading_start_mock.call_count == 0
            analytics_record_mock.assert_not_called()

    for stat in [
        Relocation.Status.IN_PROGRESS,
        Relocation.Status.PAUSE,
    ]:

        @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 3})
        @patch("sentry.relocation.tasks.uploading_start.delay")
        def test_bad_owner_has_another_active_relocation(
            self, uploading_start_mock: Mock, analytics_record_mock: Mock, stat=stat
        ):
            self.login_as(user=self.owner, superuser=False)
            Relocation.objects.create(
                date_added=TEST_DATE_ADDED,
                creator_id=self.superuser.id,
                owner_id=self.owner.id,
                status=stat.value,
                step=Relocation.Step.PREPROCESSING.value,
                want_org_slugs=["foo", "bar"],
                want_usernames=["alice", "bob"],
                scheduled_pause_at_step=Relocation.Step.IMPORTING.value,
                scheduled_cancel_at_step=Relocation.Step.NOTIFYING.value,
                latest_notified=Relocation.EmailKind.STARTED.value,
                latest_task=OrderedTask.PREPROCESSING_SCAN.name,
                latest_task_attempts=1,
            )

            response = self.get_error_response(self.relocation.uuid, status_code=409)

            assert response.data.get("detail") == ERR_DUPLICATE_RELOCATION
            assert uploading_start_mock.call_count == 0
            analytics_record_mock.assert_not_called()
