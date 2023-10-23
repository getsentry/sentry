import tempfile
from functools import cached_property
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from google_crc32c import value as crc32c

from sentry.backup.dependencies import NormalizedModelName, get_model_name
from sentry.backup.helpers import (
    create_encrypted_export_tarball,
    decrypt_data_encryption_key_local,
    unwrap_encrypted_export_tarball,
)
from sentry.models.files.file import File
from sentry.models.files.utils import get_storage
from sentry.models.relocation import Relocation, RelocationFile
from sentry.models.user import User
from sentry.tasks.relocation import (
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
from sentry.utils.relocation import RELOCATION_FILE_TYPE


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

    @cached_property
    def file(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
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


@patch("sentry.tasks.relocation.preprocessing_scan.delay")
@region_silo_test
class UploadingCompleteTest(RelocationTaskTestCase):
    def test_success(self, preprocessing_scan_mock: Mock):
        uploading_complete(self.relocation.uuid)
        assert preprocessing_scan_mock.call_count == 1

    # TODO(getsentry/team-ospo#203): Add unhappy path tests.


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
        self.relocation.latest_task = "uploading_complete"
        self.relocation.save()

    def fake_asymmetric_decrypt_method(self, fake_kms_client: FakeKeyManagementServiceClient):
        unwrapped = unwrap_encrypted_export_tarball(BytesIO(self.tarball))
        plaintext_dek = decrypt_data_encryption_key_local(unwrapped, self.priv_key_pem)
        fake_kms_client.asymmetric_decrypt.return_value = SimpleNamespace(
            plaintext=plaintext_dek,
            plaintext_crc32c=crc32c(plaintext_dek),
        )

    def test_success(
        self,
        preprocessing_baseline_config_mock: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.fake_asymmetric_decrypt_method(fake_kms_client)
        preprocessing_scan(self.relocation.uuid)
        assert fake_kms_client.asymmetric_decrypt.call_count == 1
        assert preprocessing_baseline_config_mock.call_count == 1

    # TODO(getsentry/team-ospo#203): Add unhappy path tests.


@patch("sentry.tasks.relocation.preprocessing_colliding_users.delay")
@region_silo_test
class PreprocessingBaselineConfigTest(RelocationTaskTestCase):
    def setUp(self):
        super().setUp()
        self.relocation.step = Relocation.Step.PREPROCESSING.value
        self.relocation.latest_task = "preprocessing_scan"
        self.relocation.save()

    def test_success(self, preprocessing_colliding_users_mock: Mock):
        assert (
            RelocationFile.objects.filter(
                kind=RelocationFile.Kind.BASELINE_CONFIG_VALIDATION_DATA.value
            ).count()
            == 0
        )

        preprocessing_baseline_config(self.relocation.uuid)
        assert preprocessing_colliding_users_mock.call_count == 1
        assert (
            RelocationFile.objects.filter(
                kind=RelocationFile.Kind.BASELINE_CONFIG_VALIDATION_DATA.value
            ).count()
            == 1
        )

        baseline_config_relocation_file = (
            RelocationFile.objects.filter(
                relocation=self.relocation,
                kind=RelocationFile.Kind.BASELINE_CONFIG_VALIDATION_DATA.value,
            )
            .select_related("file")
            .first()
        )
        fp = baseline_config_relocation_file.file.getfile()
        json_models = json.load(fp)
        assert len(json_models) > 0

        # Only user `superuser` is an admin, so only they should be exported.
        for json_model in json_models:
            if NormalizedModelName(json_model["model"]) == get_model_name(User):
                assert json_model["fields"]["username"] in "superuser"

    # TODO(getsentry/team-ospo#203): Add unhappy path tests.


@patch("sentry.tasks.relocation.preprocessing_complete.delay")
@region_silo_test
class PreprocessingCollidingUsersTest(RelocationTaskTestCase):
    def setUp(self):
        super().setUp()
        self.relocation.step = Relocation.Step.PREPROCESSING.value
        self.relocation.latest_task = "preprocessing_baseline_config"
        self.relocation.want_usernames = ["a", "b", "c"]
        self.relocation.save()

        self.create_user("c")
        self.create_user("d")
        self.create_user("e")

    def test_success(self, preprocessing_complete_mock: Mock):
        assert (
            RelocationFile.objects.filter(
                kind=RelocationFile.Kind.COLLIDING_USERS_VALIDATION_DATA.value
            ).count()
            == 0
        )

        preprocessing_colliding_users(self.relocation.uuid)
        assert preprocessing_complete_mock.call_count == 1
        assert (
            RelocationFile.objects.filter(
                kind=RelocationFile.Kind.COLLIDING_USERS_VALIDATION_DATA.value
            ).count()
            == 1
        )

        colliding_users_relocation_file = (
            RelocationFile.objects.filter(
                relocation=self.relocation,
                kind=RelocationFile.Kind.COLLIDING_USERS_VALIDATION_DATA.value,
            )
            .select_related("file")
            .first()
        )
        fp = colliding_users_relocation_file.file.getfile()
        json_models = json.load(fp)
        assert len(json_models) > 0

        # Only user `c` was colliding, so only they should be exported.
        for json_model in json_models:
            if NormalizedModelName(json_model["model"]) == get_model_name(User):
                assert json_model["fields"]["username"] == "c"

    # TODO(getsentry/team-ospo#203): Add unhappy path tests.


@patch("sentry.tasks.relocation.validating_start.delay")
@region_silo_test
class PreprocessingCompleteUsersTest(RelocationTaskTestCase):
    def setUp(self):
        super().setUp()
        self.relocation.step = Relocation.Step.PREPROCESSING.value
        self.relocation.latest_task = "preprocessing_colliding_users"
        self.relocation.save()

        # Use a very small blob size to simulate chunking.
        test_blob_size = 1024

        # TODO(getsentry/team-ospo#203): Use encrypted files instead.
        with open(get_fixture_path("backup", "single-option.json"), "rb") as fp:
            file = File.objects.create(name="baseline-config.json", type=RELOCATION_FILE_TYPE)
            file.putfile(fp, blob_size=test_blob_size)
            RelocationFile.objects.create(
                relocation=self.relocation,
                file=file,
                kind=RelocationFile.Kind.BASELINE_CONFIG_VALIDATION_DATA.value,
            )
            assert file.blobs.count() == 1  # So small that chunking is unnecessary.

        with open(get_fixture_path("backup", "user-with-maximum-privileges.json"), "rb") as fp:
            file = File.objects.create(name="colliding-users.json", type=RELOCATION_FILE_TYPE)
            file.putfile(fp, blob_size=test_blob_size)
            RelocationFile.objects.create(
                relocation=self.relocation,
                file=file,
                kind=RelocationFile.Kind.COLLIDING_USERS_VALIDATION_DATA.value,
            )
            assert file.blobs.count() > 1  # A bit bigger, so we get chunks.

        self.storage = get_storage()

    def test_success(self, validating_start_mock: Mock):
        assert not self.storage.exists(f"relocations/{self.relocation.uuid}")

        preprocessing_complete(self.relocation.uuid)
        assert validating_start_mock.call_count == 1

        (_, files) = self.storage.listdir(f"relocations/{self.relocation.uuid}/in")
        assert len(files) == 3
        assert "relocation-data.tar" in files
        assert "baseline-config.json" in files
        assert "colliding-users.json" in files

    # TODO(getsentry/team-ospo#203): Add unhappy path tests.
