import tempfile
from functools import cached_property
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from google_crc32c import value as crc32c

from sentry.backup.helpers import (
    create_encrypted_export_tarball,
    decrypt_data_encryption_key_local,
    unwrap_encrypted_export_tarball,
)
from sentry.models.files.file import File
from sentry.models.relocation import Relocation, RelocationFile
from sentry.tasks.relocation import preprocessing_scan, uploading_complete
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.helpers.backups import FakeKeyManagementServiceClient, generate_rsa_key_pair
from sentry.testutils.silo import region_silo_test
from sentry.utils import json


class RelocationTaskTestCase(TestCase):
    def setUp(self):
        super().setUp()
        self.owner = self.create_user(
            email="owner", is_superuser=False, is_staff=True, is_active=True
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
                    file = File.objects.create(name="export.tar", type="relocation.file")
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
@patch("sentry.tasks.relocation.preprocessing_globals.delay")
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
        self, preprocessing_globals_mock: Mock, fake_kms_client: FakeKeyManagementServiceClient
    ):
        self.fake_asymmetric_decrypt_method(fake_kms_client)
        preprocessing_scan(self.relocation.uuid)
        assert fake_kms_client.asymmetric_decrypt.call_count == 1
        assert preprocessing_globals_mock.call_count == 1

    # TODO(getsentry/team-ospo#203): Add unhappy path tests.
