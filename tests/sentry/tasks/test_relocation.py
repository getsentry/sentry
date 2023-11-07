from functools import cached_property
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import MagicMock, Mock, patch

import pytest
from google_crc32c import value as crc32c

from sentry.backup.dependencies import NormalizedModelName, get_model_name
from sentry.backup.helpers import (
    create_encrypted_export_tarball,
    decrypt_data_encryption_key_local,
    decrypt_encrypted_tarball,
    unwrap_encrypted_export_tarball,
)
from sentry.models.files.file import File
from sentry.models.files.utils import get_storage
from sentry.models.relocation import Relocation, RelocationFile
from sentry.models.user import User
from sentry.tasks.relocation import (
    ERR_PREPROCESSING_DECRYPTION,
    ERR_PREPROCESSING_INTERNAL,
    ERR_PREPROCESSING_INVALID_JSON,
    ERR_PREPROCESSING_INVALID_TARBALL,
    ERR_PREPROCESSING_MISSING_ORGS,
    ERR_PREPROCESSING_NO_ORGS,
    ERR_PREPROCESSING_NO_USERS,
    ERR_PREPROCESSING_TOO_MANY_ORGS,
    ERR_PREPROCESSING_TOO_MANY_USERS,
    ERR_UPLOADING_FAILED,
    MAX_FAST_TASK_RETRIES,
    preprocessing_baseline_config,
    preprocessing_colliding_users,
    preprocessing_complete,
    preprocessing_scan,
    uploading_complete,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.helpers.backups import FakeKeyManagementServiceClient, generate_rsa_key_pair
from sentry.testutils.silo import region_silo_test
from sentry.utils import json
from sentry.utils.relocation import RELOCATION_BLOB_SIZE, RELOCATION_FILE_TYPE


class RelocationTaskTestCase(TestCase):
    def setUp(self):
        super().setUp()
        self.owner = self.create_user(
            email="owner", is_superuser=False, is_staff=False, is_active=True
        )
        self.superuser = self.create_user(
            "superuser", is_superuser=True, is_staff=True, is_active=True
        )
        self.login_as(user=self.superuser, superuser=True)
        self.relocation: Relocation = Relocation.objects.create(
            creator=self.superuser.id,
            owner=self.owner.id,
            want_org_slugs=["testing"],
            step=Relocation.Step.UPLOADING.value,
        )
        self.relocation_file = RelocationFile.objects.create(
            relocation=self.relocation,
            file=self.file,
            kind=RelocationFile.Kind.RAW_USER_DATA.value,
        )
        self.uuid = self.relocation.uuid

    @cached_property
    def file(self):
        with TemporaryDirectory() as tmp_dir:
            (priv_key_pem, pub_key_pem) = generate_rsa_key_pair()
            tmp_priv_key_path = Path(tmp_dir).joinpath("key")
            self.priv_key_pem = priv_key_pem
            with open(tmp_priv_key_path, "wb") as f:
                f.write(priv_key_pem)

            tmp_pub_key_path = Path(tmp_dir).joinpath("key.pub")
            self.pub_key_pem = pub_key_pem
            with open(tmp_pub_key_path, "wb") as f:
                f.write(pub_key_pem)

            with open(get_fixture_path("backup", "fresh-install.json")) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    file = File.objects.create(name="export.tar", type=RELOCATION_FILE_TYPE)
                    self.tarball = create_encrypted_export_tarball(data, p).getvalue()
                    file.putfile(BytesIO(self.tarball))

            return file

    def swap_file(
        self, file: File, fixture_name: str, blob_size: int = RELOCATION_BLOB_SIZE
    ) -> None:
        with TemporaryDirectory() as tmp_dir:
            tmp_priv_key_path = Path(tmp_dir).joinpath("key")
            tmp_pub_key_path = Path(tmp_dir).joinpath("key.pub")
            with open(tmp_priv_key_path, "wb") as f:
                f.write(self.priv_key_pem)
            with open(tmp_pub_key_path, "wb") as f:
                f.write(self.pub_key_pem)
            with open(get_fixture_path("backup", fixture_name)) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    self.tarball = create_encrypted_export_tarball(data, p).getvalue()
                    file.putfile(BytesIO(self.tarball), blob_size=blob_size)

    def mock_kms_client(self, fake_kms_client: FakeKeyManagementServiceClient):
        fake_kms_client.asymmetric_decrypt.call_count = 0
        fake_kms_client.get_public_key.call_count = 0

        unwrapped = unwrap_encrypted_export_tarball(BytesIO(self.tarball))
        plaintext_dek = decrypt_data_encryption_key_local(unwrapped, self.priv_key_pem)

        fake_kms_client.asymmetric_decrypt.return_value = SimpleNamespace(
            plaintext=plaintext_dek,
            plaintext_crc32c=crc32c(plaintext_dek),
        )
        fake_kms_client.get_public_key.return_value = SimpleNamespace(
            pem=self.pub_key_pem.decode("utf-8")
        )


@patch("sentry.tasks.relocation.preprocessing_scan.delay")
@region_silo_test
class UploadingCompleteTest(RelocationTaskTestCase):
    def test_success(self, preprocessing_scan_mock: Mock):
        uploading_complete(self.relocation.uuid)

        assert preprocessing_scan_mock.call_count == 1

    def test_retry_if_attempts_left(self, preprocessing_scan_mock: Mock):
        RelocationFile.objects.filter(relocation=self.relocation).delete()

        # An exception being raised will trigger a retry in celery.
        with pytest.raises(Exception):
            uploading_complete(self.relocation.uuid)

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.IN_PROGRESS.value
        assert not relocation.failure_reason
        assert preprocessing_scan_mock.call_count == 0

    def test_fail_if_no_attempts_left(self, preprocessing_scan_mock: Mock):
        self.relocation.latest_task = "UPLOADING_COMPLETE"
        self.relocation.latest_task_attempts = MAX_FAST_TASK_RETRIES
        self.relocation.save()
        RelocationFile.objects.filter(relocation=self.relocation).delete()

        uploading_complete(self.relocation.uuid)

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.failure_reason == ERR_UPLOADING_FAILED
        assert preprocessing_scan_mock.call_count == 0


@patch(
    "sentry.backup.helpers.KeyManagementServiceClient",
    new_callable=lambda: FakeKeyManagementServiceClient,
)
@patch("sentry.tasks.relocation.preprocessing_baseline_config.delay")
@region_silo_test
class PreprocessingScanTest(RelocationTaskTestCase):
    def setUp(self):
        super().setUp()
        self.relocation.step = Relocation.Step.PREPROCESSING.value
        self.relocation.latest_task = "UPLOADING_COMPLETE"
        self.relocation.save()

    def test_success(
        self,
        preprocessing_baseline_config_mock: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.mock_kms_client(fake_kms_client)

        preprocessing_scan(self.uuid)

        assert fake_kms_client.asymmetric_decrypt.call_count == 1
        assert fake_kms_client.get_public_key.call_count == 0
        assert preprocessing_baseline_config_mock.call_count == 1
        assert Relocation.objects.get(uuid=self.uuid).want_usernames == ["testing@example.com"]

    def test_retry_if_attempts_left(
        self,
        preprocessing_baseline_config_mock: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        RelocationFile.objects.filter(relocation=self.relocation).delete()

        # An exception being raised will trigger a retry in celery.
        with pytest.raises(Exception):
            self.mock_kms_client(fake_kms_client)
            preprocessing_scan(self.uuid)

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.IN_PROGRESS.value
        assert not relocation.failure_reason
        assert fake_kms_client.asymmetric_decrypt.call_count == 0
        assert fake_kms_client.get_public_key.call_count == 0
        assert preprocessing_baseline_config_mock.call_count == 0

    def test_fail_if_no_attempts_left(
        self,
        preprocessing_baseline_config_mock: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.relocation.latest_task = "PREPROCESSING_SCAN"
        self.relocation.latest_task_attempts = MAX_FAST_TASK_RETRIES
        self.relocation.save()
        RelocationFile.objects.filter(relocation=self.relocation).delete()
        self.mock_kms_client(fake_kms_client)

        preprocessing_scan(self.uuid)

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.failure_reason == ERR_PREPROCESSING_INTERNAL
        assert fake_kms_client.asymmetric_decrypt.call_count == 0
        assert fake_kms_client.get_public_key.call_count == 0
        assert preprocessing_baseline_config_mock.call_count == 0

    def test_fail_invalid_tarball(
        self,
        preprocessing_baseline_config_mock: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        file = RelocationFile.objects.get(relocation=self.relocation).file
        corrupted_tarball_bytes = bytearray(file.getfile().read())[9:]
        file.putfile(BytesIO(bytes(corrupted_tarball_bytes)))
        self.mock_kms_client(fake_kms_client)

        preprocessing_scan(self.uuid)

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.failure_reason == ERR_PREPROCESSING_INVALID_TARBALL
        assert preprocessing_baseline_config_mock.call_count == 0

    def test_fail_decryption_failure(
        self,
        preprocessing_baseline_config_mock: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        # Add invalid 2-octet UTF-8 sequence to the returned plaintext.
        self.mock_kms_client(fake_kms_client)
        fake_kms_client.asymmetric_decrypt.return_value.plaintext += b"\xc3\x28"

        preprocessing_scan(self.uuid)

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.failure_reason == ERR_PREPROCESSING_DECRYPTION
        assert preprocessing_baseline_config_mock.call_count == 0

    def test_fail_invalid_json(
        self,
        preprocessing_baseline_config_mock: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        file = RelocationFile.objects.get(relocation=self.relocation).file
        self.swap_file(file, "invalid-user.json")
        self.mock_kms_client(fake_kms_client)

        preprocessing_scan(self.uuid)

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.failure_reason == ERR_PREPROCESSING_INVALID_JSON
        assert preprocessing_baseline_config_mock.call_count == 0

    def test_fail_no_users(
        self,
        preprocessing_baseline_config_mock: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        file = RelocationFile.objects.get(relocation=self.relocation).file
        self.swap_file(file, "single-option.json")
        self.mock_kms_client(fake_kms_client)

        preprocessing_scan(self.uuid)

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.failure_reason == ERR_PREPROCESSING_NO_USERS
        assert preprocessing_baseline_config_mock.call_count == 0

    @patch("sentry.tasks.relocation.MAX_USERS_PER_RELOCATION", 0)
    def test_fail_too_many_users(
        self,
        preprocessing_baseline_config_mock: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.mock_kms_client(fake_kms_client)

        preprocessing_scan(self.uuid)

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.failure_reason == ERR_PREPROCESSING_TOO_MANY_USERS.substitute(count=1)
        assert preprocessing_baseline_config_mock.call_count == 0

    def test_fail_no_orgs(
        self,
        preprocessing_baseline_config_mock: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        file = RelocationFile.objects.get(relocation=self.relocation).file
        self.swap_file(file, "user-with-minimum-privileges.json")
        self.mock_kms_client(fake_kms_client)

        preprocessing_scan(self.uuid)

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.failure_reason == ERR_PREPROCESSING_NO_ORGS
        assert preprocessing_baseline_config_mock.call_count == 0

    @patch("sentry.tasks.relocation.MAX_ORGS_PER_RELOCATION", 0)
    def test_fail_too_many_orgs(
        self,
        preprocessing_baseline_config_mock: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.mock_kms_client(fake_kms_client)

        preprocessing_scan(self.uuid)

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.failure_reason == ERR_PREPROCESSING_TOO_MANY_ORGS.substitute(count=1)
        assert preprocessing_baseline_config_mock.call_count == 0

    def test_fail_missing_orgs(
        self,
        preprocessing_baseline_config_mock: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        orgs = ["does-not-exist"]
        relocation = Relocation.objects.get(uuid=self.uuid)
        relocation.want_org_slugs = orgs
        relocation.save()
        self.mock_kms_client(fake_kms_client)

        preprocessing_scan(self.uuid)

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.failure_reason == ERR_PREPROCESSING_MISSING_ORGS.substitute(
            orgs=",".join(orgs)
        )
        assert preprocessing_baseline_config_mock.call_count == 0


@patch(
    "sentry.backup.helpers.KeyManagementServiceClient",
    new_callable=lambda: FakeKeyManagementServiceClient,
)
@patch("sentry.tasks.relocation.preprocessing_colliding_users.delay")
@region_silo_test
class PreprocessingBaselineConfigTest(RelocationTaskTestCase):
    def setUp(self):
        super().setUp()
        self.relocation.step = Relocation.Step.PREPROCESSING.value
        self.relocation.latest_task = "PREPROCESSING_SCAN"
        self.relocation.save()

    def test_success(
        self,
        preprocessing_colliding_users_mock: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.mock_kms_client(fake_kms_client)

        preprocessing_baseline_config(self.relocation.uuid)

        assert fake_kms_client.asymmetric_decrypt.call_count == 0
        assert fake_kms_client.get_public_key.call_count == 1
        assert preprocessing_colliding_users_mock.call_count == 1

        relocation_file = (
            RelocationFile.objects.filter(
                relocation=self.relocation,
                kind=RelocationFile.Kind.BASELINE_CONFIG_VALIDATION_DATA.value,
            )
            .select_related("file")
            .first()
        )
        assert relocation_file.file.name == "baseline-config.tar"

        with relocation_file.file.getfile() as fp:
            json_models = json.loads(
                decrypt_encrypted_tarball(fp, False, BytesIO(self.priv_key_pem))
            )
        assert len(json_models) > 0

        # Only user `superuser` is an admin, so only they should be exported.
        for json_model in json_models:
            if NormalizedModelName(json_model["model"]) == get_model_name(User):
                assert json_model["fields"]["username"] in "superuser"

    @patch(
        "sentry.tasks.relocation.get_public_key_using_gcp_kms",
        MagicMock(side_effect=Exception("Test")),
    )
    def test_retry_if_attempts_left(
        self,
        preprocessing_colliding_users_mock: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        RelocationFile.objects.filter(relocation=self.relocation).delete()

        # An exception being raised will trigger a retry in celery.
        with pytest.raises(Exception):
            self.mock_kms_client(fake_kms_client)
            preprocessing_baseline_config(self.uuid)

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.IN_PROGRESS.value
        assert not relocation.failure_reason
        assert fake_kms_client.asymmetric_decrypt.call_count == 0
        assert fake_kms_client.get_public_key.call_count == 0
        assert preprocessing_colliding_users_mock.call_count == 0

    @patch(
        "sentry.tasks.relocation.get_public_key_using_gcp_kms",
        MagicMock(side_effect=Exception("Test")),
    )
    def test_fail_if_no_attempts_left(
        self,
        preprocessing_colliding_users_mock: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.relocation.latest_task = "PREPROCESSING_BASELINE_CONFIG"
        self.relocation.latest_task_attempts = MAX_FAST_TASK_RETRIES
        self.relocation.save()
        RelocationFile.objects.filter(relocation=self.relocation).delete()
        self.mock_kms_client(fake_kms_client)

        preprocessing_baseline_config(self.uuid)

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.failure_reason == ERR_PREPROCESSING_INTERNAL
        assert fake_kms_client.asymmetric_decrypt.call_count == 0
        assert fake_kms_client.get_public_key.call_count == 0
        assert preprocessing_colliding_users_mock.call_count == 0


@patch(
    "sentry.backup.helpers.KeyManagementServiceClient",
    new_callable=lambda: FakeKeyManagementServiceClient,
)
@patch("sentry.tasks.relocation.preprocessing_complete.delay")
@region_silo_test
class PreprocessingCollidingUsersTest(RelocationTaskTestCase):
    def setUp(self):
        super().setUp()
        self.relocation.step = Relocation.Step.PREPROCESSING.value
        self.relocation.latest_task = "PREPROCESSING_BASELINE_CONFIG"
        self.relocation.want_usernames = ["a", "b", "c"]
        self.relocation.save()

        self.create_user("c")
        self.create_user("d")
        self.create_user("e")

    def test_success(
        self,
        preprocessing_complete_mock: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.mock_kms_client(fake_kms_client)
        preprocessing_colliding_users(self.relocation.uuid)

        assert preprocessing_complete_mock.call_count == 1
        assert fake_kms_client.asymmetric_decrypt.call_count == 0
        assert fake_kms_client.get_public_key.call_count == 1

        relocation_file = (
            RelocationFile.objects.filter(
                relocation=self.relocation,
                kind=RelocationFile.Kind.COLLIDING_USERS_VALIDATION_DATA.value,
            )
            .select_related("file")
            .first()
        )
        assert relocation_file.file.name == "colliding-users.tar"

        with relocation_file.file.getfile() as fp:
            json_models = json.loads(
                decrypt_encrypted_tarball(fp, False, BytesIO(self.priv_key_pem))
            )
        assert len(json_models) > 0

        # Only user `c` was colliding, so only they should be exported.
        for json_model in json_models:
            if NormalizedModelName(json_model["model"]) == get_model_name(User):
                assert json_model["fields"]["username"] == "c"

    @patch(
        "sentry.tasks.relocation.get_public_key_using_gcp_kms",
        MagicMock(side_effect=Exception("Test")),
    )
    def test_retry_if_attempts_left(
        self,
        preprocessing_complete_mock: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        RelocationFile.objects.filter(relocation=self.relocation).delete()

        # An exception being raised will trigger a retry in celery.
        with pytest.raises(Exception):
            self.mock_kms_client(fake_kms_client)
            preprocessing_colliding_users(self.uuid)

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.IN_PROGRESS.value
        assert not relocation.failure_reason
        assert fake_kms_client.asymmetric_decrypt.call_count == 0
        assert fake_kms_client.get_public_key.call_count == 0
        assert preprocessing_complete_mock.call_count == 0

    @patch(
        "sentry.tasks.relocation.get_public_key_using_gcp_kms",
        MagicMock(side_effect=Exception("Test")),
    )
    def test_fail_if_no_attempts_left(
        self,
        preprocessing_complete_mock: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.relocation.latest_task = "PREPROCESSING_COLLIDING_USERS"
        self.relocation.latest_task_attempts = MAX_FAST_TASK_RETRIES
        self.relocation.save()
        RelocationFile.objects.filter(relocation=self.relocation).delete()
        self.mock_kms_client(fake_kms_client)

        preprocessing_colliding_users(self.uuid)

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.failure_reason == ERR_PREPROCESSING_INTERNAL
        assert fake_kms_client.asymmetric_decrypt.call_count == 0
        assert fake_kms_client.get_public_key.call_count == 0
        assert preprocessing_complete_mock.call_count == 0


@patch("sentry.tasks.relocation.validating_start.delay")
@region_silo_test
class PreprocessingCompleteTest(RelocationTaskTestCase):
    def setUp(self):
        super().setUp()
        self.relocation.step = Relocation.Step.PREPROCESSING.value
        self.relocation.latest_task = "PREPROCESSING_COLLIDING_USERS"
        self.relocation.want_usernames = ["importing"]
        self.relocation.save()
        self.create_user("importing")
        self.storage = get_storage()

        file = File.objects.create(name="baseline-config.tar", type=RELOCATION_FILE_TYPE)
        self.swap_file(file, "single-option.json", blob_size=16384)  # No chunking
        RelocationFile.objects.create(
            relocation=self.relocation,
            file=file,
            kind=RelocationFile.Kind.BASELINE_CONFIG_VALIDATION_DATA.value,
        )
        assert file.blobs.count() == 1  # So small that chunking is unnecessary.

        file = File.objects.create(name="colliding-users.tar", type=RELOCATION_FILE_TYPE)
        self.swap_file(file, "user-with-maximum-privileges.json", blob_size=8192)  # Forces chunks
        RelocationFile.objects.create(
            relocation=self.relocation,
            file=file,
            kind=RelocationFile.Kind.COLLIDING_USERS_VALIDATION_DATA.value,
        )
        assert file.blobs.count() > 1  # A bit bigger, so we get chunks.

    def test_success(self, validating_start_mock: Mock):
        assert not self.storage.exists(f"relocations/runs/{self.relocation.uuid}")

        preprocessing_complete(self.relocation.uuid)

        self.relocation.refresh_from_db()
        assert validating_start_mock.call_count == 1

        (_, files) = self.storage.listdir(f"relocations/runs/{self.relocation.uuid}/in")
        assert len(files) == 3
        assert "raw-relocation-data.tar" in files
        assert "baseline-config.tar" in files
        assert "colliding-users.tar" in files

    def test_retry_if_attempts_left(self, validating_start_mock: Mock):
        RelocationFile.objects.filter(relocation=self.relocation).delete()

        # An exception being raised will trigger a retry in celery.
        with pytest.raises(Exception):
            preprocessing_complete(self.relocation.uuid)

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.IN_PROGRESS.value
        assert not relocation.failure_reason
        assert validating_start_mock.call_count == 0

    def test_fail_if_no_attempts_left(self, validating_start_mock: Mock):
        self.relocation.latest_task = "PREPROCESSING_COMPLETE"
        self.relocation.latest_task_attempts = MAX_FAST_TASK_RETRIES
        self.relocation.save()
        RelocationFile.objects.filter(relocation=self.relocation).delete()

        preprocessing_complete(self.relocation.uuid)

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.failure_reason == ERR_PREPROCESSING_INTERNAL
        assert validating_start_mock.call_count == 0
