import tempfile
from pathlib import Path
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from sentry.backup.helpers import create_encrypted_export_tarball
from sentry.models.relocation import Relocation, RelocationFile
from sentry.testutils.cases import APITestCase
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.helpers.backups import generate_rsa_key_pair
from sentry.testutils.silo import region_silo_test
from sentry.utils import json


@region_silo_test
class RelocationCreateTest(APITestCase):
    endpoint = "sentry-api-0-relocation"

    def setUp(self):
        super().setUp()
        self.owner = self.create_user(
            email="owner", is_superuser=False, is_staff=True, is_active=True
        )
        self.superuser = self.create_user(
            "superuser", is_superuser=True, is_staff=True, is_active=True
        )
        self.login_as(user=self.superuser, superuser=True)

    @patch("sentry.tasks.relocation.uploading_complete.delay")
    def test_success(self, uploading_complete):
        username = self.owner.username
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        with tempfile.TemporaryDirectory() as tmp_dir:
            (priv_key_pem, pub_key_pem) = generate_rsa_key_pair()
            tmp_priv_key_path = Path(tmp_dir).joinpath("key")
            with open(tmp_priv_key_path, "wb") as f:
                f.write(priv_key_pem)

            tmp_pub_key_path = Path(tmp_dir).joinpath("key.pub")
            with open(tmp_pub_key_path, "wb") as f:
                f.write(pub_key_pem)

            with open(get_fixture_path("backup", "fresh-install.json")) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    url = reverse("sentry-api-0-relocation")
                    response = self.client.post(
                        url,
                        {
                            "owner": username,
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(data, p).getvalue(),
                                content_type="application/tar",
                            ),
                            "orgs": ["testing", "foo"],
                        },
                        format="multipart",
                    )

        assert response.status_code == 201
        assert Relocation.objects.count() == relocation_count + 1
        assert RelocationFile.objects.count() == relocation_file_count + 1
        assert uploading_complete.called == 1
