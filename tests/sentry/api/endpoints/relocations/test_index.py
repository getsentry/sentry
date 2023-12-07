import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Tuple
from unittest.mock import patch
from uuid import UUID

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from sentry.api.endpoints.relocations import ERR_FEATURE_DISABLED
from sentry.api.endpoints.relocations.index import (
    ERR_INVALID_ORG_SLUG,
    ERR_OWNER_NOT_FOUND,
    ERR_UNKNOWN_RELOCATION_STATUS,
)
from sentry.backup.helpers import LocalFileEncryptor, create_encrypted_export_tarball
from sentry.models.relocation import Relocation, RelocationFile
from sentry.testutils.cases import APITestCase
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.helpers.backups import generate_rsa_key_pair
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import region_silo_test
from sentry.utils import json
from sentry.utils.relocation import OrderedTask

FRESH_INSTALL_PATH = get_fixture_path("backup", "fresh-install.json")
TEST_DATE_ADDED = datetime(2023, 1, 23, 1, 23, 45, tzinfo=timezone.utc)
TEST_DATE_UPDATED = datetime(2023, 1, 23, 1, 24, 45, tzinfo=timezone.utc)


@freeze_time(TEST_DATE_UPDATED)
@region_silo_test
class GetRelocationsTest(APITestCase):
    endpoint = "sentry-api-0-relocations-index"

    def setUp(self):
        super().setUp()
        self.owner = self.create_user(
            email="owner", is_superuser=False, is_staff=True, is_active=True
        )
        self.superuser = self.create_user(
            "superuser", is_superuser=True, is_staff=True, is_active=True
        )
        self.login_as(user=self.superuser, superuser=True)
        self.path = reverse(self.endpoint)

        # Add 1 relocation of each status.
        common = {
            "creator_id": self.superuser.id,
            "owner_id": self.owner.id,
            "latest_task_attempts": 1,
        }
        Relocation.objects.create(
            uuid=UUID("ccef828a-03d8-4dd0-918a-487ffecf8717"),
            date_added=TEST_DATE_ADDED + timedelta(seconds=1),
            status=Relocation.Status.IN_PROGRESS.value,
            step=Relocation.Step.IMPORTING.value,
            scheduled_pause_at_step=Relocation.Step.POSTPROCESSING.value,
            want_org_slugs='["foo"]',
            want_usernames='["alice", "bob"]',
            latest_notified=Relocation.EmailKind.STARTED.value,
            latest_task=OrderedTask.IMPORTING.name,
            **common,
        )
        Relocation.objects.create(
            uuid=UUID("af3d45ee-ce76-4de0-90c1-fc739da29523"),
            date_added=TEST_DATE_ADDED + timedelta(seconds=2),
            status=Relocation.Status.PAUSE.value,
            step=Relocation.Step.IMPORTING.value,
            want_org_slugs='["bar"]',
            want_usernames='["charlie", "denise"]',
            latest_notified=Relocation.EmailKind.STARTED.value,
            latest_task=OrderedTask.IMPORTING.name,
            **common,
        )
        Relocation.objects.create(
            uuid=UUID("1ecc8862-7a3a-4114-bbc1-b6b80eb90197"),
            date_added=TEST_DATE_ADDED + timedelta(seconds=3),
            status=Relocation.Status.SUCCESS.value,
            step=Relocation.Step.COMPLETED.value,
            want_org_slugs='["foo"]',
            want_usernames='["emily", "fred"]',
            latest_notified=Relocation.EmailKind.SUCCEEDED.value,
            latest_task=OrderedTask.COMPLETED.name,
            latest_unclaimed_emails_sent_at=TEST_DATE_UPDATED,
            **common,
        )
        Relocation.objects.create(
            uuid=UUID("8f478ea5-6250-4133-8539-2c0103f9d271"),
            date_added=TEST_DATE_ADDED + timedelta(seconds=4),
            status=Relocation.Status.FAILURE.value,
            failure_reason="Some failure reason",
            step=Relocation.Step.VALIDATING.value,
            scheduled_cancel_at_step=Relocation.Step.IMPORTING.value,
            want_org_slugs='["qux"]',
            want_usernames='["alice", "greg"]',
            latest_notified=Relocation.EmailKind.FAILED.value,
            latest_task=OrderedTask.VALIDATING_COMPLETE.name,
            **common,
        )

        self.success_uuid = Relocation.objects.get(status=Relocation.Status.SUCCESS.value)

    def test_good_simple(self):
        response = self.client.get(f"{self.path}")

        assert response.status_code == 200
        assert len(response.data) == 4

    def test_good_status_in_progress(self):
        response = self.client.get(f"{self.path}?status={Relocation.Status.IN_PROGRESS.name}")

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["status"] == Relocation.Status.IN_PROGRESS.name

    def test_good_status_pause(self):
        response = self.client.get(f"{self.path}?status={Relocation.Status.PAUSE.name}")

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["status"] == Relocation.Status.PAUSE.name

    def test_good_status_success(self):
        response = self.client.get(f"{self.path}?status={Relocation.Status.SUCCESS.name}")

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["status"] == Relocation.Status.SUCCESS.name

    def test_good_status_failure(self):
        response = self.client.get(f"{self.path}?status={Relocation.Status.FAILURE.name}")

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["status"] == Relocation.Status.FAILURE.name

    def test_single_query_partial_uuid(self):
        response = self.client.get(f"{self.path}?query=ccef828a")

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["status"] == Relocation.Status.IN_PROGRESS.name

    def test_single_query_full_uuid(self):
        response = self.client.get(
            f"{self.path}?query=af3d45ee%2Dce76%2D4de0%2D90c1%2Dfc739da29523"
        )

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["status"] == Relocation.Status.PAUSE.name

    def test_single_query_org_slug(self):
        response = self.client.get(f"{self.path}?query=foo")

        assert response.status_code == 200
        assert len(response.data) == 2
        assert response.data[0]["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data[1]["status"] == Relocation.Status.SUCCESS.name

    def test_single_query_username(self):
        response = self.client.get(f"{self.path}?query=alice")

        assert response.status_code == 200
        assert len(response.data) == 2
        assert response.data[0]["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data[1]["status"] == Relocation.Status.FAILURE.name

    def test_single_query_letter(self):
        response = self.client.get(f"{self.path}?query=b")

        assert response.status_code == 200
        assert len(response.data) == 3
        assert response.data[0]["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data[1]["status"] == Relocation.Status.PAUSE.name
        assert response.data[2]["status"] == Relocation.Status.SUCCESS.name

    def test_multiple_queries(self):
        response = self.client.get(f"{self.path}?query=foo%20alice")

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["status"] == Relocation.Status.IN_PROGRESS.name

    def test_bad_unknown_status(self):
        response = self.client.get(f"{self.path}?status=nonexistent")

        assert response.status_code == 400
        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_UNKNOWN_RELOCATION_STATUS.substitute(
            status="nonexistent"
        )


@region_silo_test
class PostRelocationTest(APITestCase):
    endpoint = "sentry-api-0-relocations-index"

    def setUp(self):
        super().setUp()
        self.owner = self.create_user(
            email="owner", is_superuser=False, is_staff=True, is_active=True
        )
        self.superuser = self.create_user(
            "superuser", is_superuser=True, is_staff=True, is_active=True
        )
        self.login_as(user=self.superuser, superuser=True)

    def tmp_keys(self, tmp_dir: str) -> Tuple[Path, Path]:
        (priv_key_pem, pub_key_pem) = generate_rsa_key_pair()
        tmp_priv_key_path = Path(tmp_dir).joinpath("key")
        with open(tmp_priv_key_path, "wb") as f:
            f.write(priv_key_pem)

        tmp_pub_key_path = Path(tmp_dir).joinpath("key.pub")
        with open(tmp_pub_key_path, "wb") as f:
            f.write(pub_key_pem)

        return (tmp_priv_key_path, tmp_pub_key_path)

    @patch("sentry.tasks.relocation.uploading_complete.delay")
    def test_success_simple(self, uploading_complete_mock):
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with self.options(
                {
                    "relocation.enabled": True,
                    "relocation.daily-limit-small": 1,
                }
            ), open(FRESH_INSTALL_PATH) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    response = self.client.post(
                        reverse(self.endpoint),
                        {
                            "owner": self.owner.username,
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(
                                    data, LocalFileEncryptor(p)
                                ).getvalue(),
                                content_type="application/tar",
                            ),
                            "orgs": "testing",
                        },
                        format="multipart",
                    )

        assert response.status_code == 201
        assert Relocation.objects.count() == relocation_count + 1
        assert RelocationFile.objects.count() == relocation_file_count + 1
        assert Relocation.objects.get(owner_id=self.owner.id).want_org_slugs == ["testing"]
        assert uploading_complete_mock.call_count == 1

    # pytest parametrize does not work in TestCase subclasses, so hack around this
    for org_slugs, expected in [
        ("testing,foo,", ["testing", "foo"]),
        ("testing, foo", ["testing", "foo"]),
        ("testing,\tfoo", ["testing", "foo"]),
        ("testing,\nfoo", ["testing", "foo"]),
    ]:

        @patch("sentry.tasks.relocation.uploading_complete.delay")
        def test_success_good_org_slugs(
            self, uploading_complete_mock, org_slugs=org_slugs, expected=expected
        ):
            relocation_count = Relocation.objects.count()
            relocation_file_count = RelocationFile.objects.count()

            with tempfile.TemporaryDirectory() as tmp_dir:
                (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
                with self.options(
                    {"relocation.enabled": True, "relocation.daily-limit-small": 1}
                ), open(FRESH_INSTALL_PATH) as f:
                    data = json.load(f)
                    with open(tmp_pub_key_path, "rb") as p:
                        response = self.client.post(
                            reverse(self.endpoint),
                            {
                                "owner": self.owner.username,
                                "file": SimpleUploadedFile(
                                    "export.tar",
                                    create_encrypted_export_tarball(
                                        data, LocalFileEncryptor(p)
                                    ).getvalue(),
                                    content_type="application/tar",
                                ),
                                "orgs": org_slugs,
                            },
                            format="multipart",
                        )

            assert response.status_code == 201
            assert Relocation.objects.count() == relocation_count + 1
            assert RelocationFile.objects.count() == relocation_file_count + 1
            assert Relocation.objects.get(owner_id=self.owner.id).want_org_slugs == expected
            assert uploading_complete_mock.call_count == 1

    for org_slugs, invalid_org_slug in [
        (",,", ""),
        ("testing,,foo", ""),
        ("testing\nfoo", "testing\nfoo"),
        ("testing\tfoo", "testing\tfoo"),
    ]:

        @patch("sentry.tasks.relocation.uploading_complete.delay")
        def test_fail_bad_org_slugs(
            self, uploading_complete_mock, org_slugs=org_slugs, invalid_org_slug=invalid_org_slug
        ):
            relocation_count = Relocation.objects.count()
            relocation_file_count = RelocationFile.objects.count()

            with tempfile.TemporaryDirectory() as tmp_dir:
                (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
                with self.options(
                    {"relocation.enabled": True, "relocation.daily-limit-small": 1}
                ), open(FRESH_INSTALL_PATH) as f:
                    data = json.load(f)
                    with open(tmp_pub_key_path, "rb") as p:
                        response = self.client.post(
                            reverse(self.endpoint),
                            {
                                "owner": self.owner.username,
                                "file": SimpleUploadedFile(
                                    "export.tar",
                                    create_encrypted_export_tarball(
                                        data, LocalFileEncryptor(p)
                                    ).getvalue(),
                                    content_type="application/tar",
                                ),
                                "orgs": org_slugs,
                            },
                            format="multipart",
                        )

            assert response.status_code == 400
            assert response.data.get("detail") is not None
            assert response.data.get("detail") == ERR_INVALID_ORG_SLUG.substitute(
                org_slug=invalid_org_slug
            )
            assert Relocation.objects.count() == relocation_count
            assert RelocationFile.objects.count() == relocation_file_count

    def test_success_relocation_for_same_owner_already_completed(self):
        Relocation.objects.create(
            creator_id=self.superuser.id,
            owner_id=self.owner.id,
            want_org_slugs=["not-relevant-to-this-test"],
            step=Relocation.Step.COMPLETED.value,
            status=Relocation.Status.FAILURE.value,
        )
        Relocation.objects.create(
            creator_id=self.superuser.id,
            owner_id=self.owner.id,
            want_org_slugs=["not-relevant-to-this-test"],
            step=Relocation.Step.COMPLETED.value,
            status=Relocation.Status.SUCCESS.value,
        )
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with self.options(
                {
                    "relocation.enabled": True,
                    "relocation.daily-limit-small": 1,
                }
            ), open(FRESH_INSTALL_PATH) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    response = self.client.post(
                        reverse(self.endpoint),
                        {
                            "owner": self.owner.username,
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(
                                    data, LocalFileEncryptor(p)
                                ).getvalue(),
                                content_type="application/tar",
                            ),
                            "orgs": "testing, foo",
                        },
                        format="multipart",
                    )

        assert response.status_code == 201
        assert Relocation.objects.count() == relocation_count + 1
        assert RelocationFile.objects.count() == relocation_file_count + 1

    def test_fail_feature_disabled(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with open(FRESH_INSTALL_PATH) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    response = self.client.post(
                        reverse(self.endpoint),
                        {
                            "owner": self.owner.username,
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(
                                    data, LocalFileEncryptor(p)
                                ).getvalue(),
                                content_type="application/tar",
                            ),
                            "orgs": "testing, foo",
                        },
                        format="multipart",
                    )

        assert response.status_code == 400
        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_FEATURE_DISABLED

    def test_fail_missing_file(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with self.options(
                {
                    "relocation.enabled": True,
                    "relocation.daily-limit-small": 1,
                }
            ):
                response = self.client.post(
                    reverse(self.endpoint),
                    {
                        "owner": self.owner.username,
                        "orgs": "testing, foo",
                    },
                    format="multipart",
                )

        assert response.status_code == 400
        assert response.data.get("file") is not None
        assert response.data.get("file")[0].code == "required"

    def test_fail_missing_orgs(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with self.options(
                {
                    "relocation.enabled": True,
                    "relocation.daily-limit-small": 1,
                }
            ), open(FRESH_INSTALL_PATH) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    response = self.client.post(
                        reverse(self.endpoint),
                        {
                            "owner": self.owner.username,
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(
                                    data, LocalFileEncryptor(p)
                                ).getvalue(),
                                content_type="application/tar",
                            ),
                        },
                        format="multipart",
                    )

        assert response.status_code == 400
        assert response.data.get("orgs") is not None
        assert response.data.get("orgs")[0].code == "required"

    def test_fail_missing_owner(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with self.options(
                {
                    "relocation.enabled": True,
                    "relocation.daily-limit-small": 1,
                }
            ), open(FRESH_INSTALL_PATH) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    response = self.client.post(
                        reverse(self.endpoint),
                        {
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(
                                    data, LocalFileEncryptor(p)
                                ).getvalue(),
                                content_type="application/tar",
                            ),
                            "orgs": "testing, foo",
                        },
                        format="multipart",
                    )

        assert response.status_code == 400
        assert response.data.get("owner") is not None
        assert response.data.get("owner")[0].code == "required"

    def test_fail_nonexistent_owner(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with self.options(
                {
                    "relocation.enabled": True,
                    "relocation.daily-limit-small": 1,
                }
            ), open(FRESH_INSTALL_PATH) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    response = self.client.post(
                        reverse(self.endpoint),
                        {
                            "owner": "doesnotexist",
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(
                                    data, LocalFileEncryptor(p)
                                ).getvalue(),
                                content_type="application/tar",
                            ),
                            "orgs": "testing, foo",
                        },
                        format="multipart",
                    )

        assert response.status_code == 400
        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_OWNER_NOT_FOUND.substitute(
            owner_username="doesnotexist"
        )

    def test_fail_relocation_for_same_owner_already_in_progress(self):
        Relocation.objects.create(
            creator_id=self.superuser.id,
            owner_id=self.owner.id,
            want_org_slugs=["not-relevant-to-this-test"],
            step=Relocation.Step.UPLOADING.value,
        )

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with self.options(
                {
                    "relocation.enabled": True,
                    "relocation.daily-limit-small": 1,
                }
            ), open(FRESH_INSTALL_PATH) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    simple_file = SimpleUploadedFile(
                        "export.tar",
                        create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                        content_type="application/tar",
                    )
                    simple_file.name = None
                    response = self.client.post(
                        reverse(self.endpoint),
                        {
                            "owner": self.owner.username,
                            "file": simple_file,
                            "orgs": "testing, foo",
                        },
                        format="multipart",
                    )

        assert response.status_code == 409

    def test_fail_throttle_if_daily_limit_reached(self):
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with self.options(
                {
                    "relocation.enabled": True,
                    "relocation.daily-limit-small": 1,
                }
            ), open(FRESH_INSTALL_PATH) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    initial_response = self.client.post(
                        reverse(self.endpoint),
                        {
                            "owner": self.owner.username,
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(
                                    data, LocalFileEncryptor(p)
                                ).getvalue(),
                                content_type="application/tar",
                            ),
                            "orgs": "testing, foo",
                        },
                        format="multipart",
                    )

                    # Simulate completion of relocation job
                    relocation = Relocation.objects.all()[0]
                    relocation.status = Relocation.Status.SUCCESS.value
                    relocation.save()
                    relocation.refresh_from_db()

                with open(tmp_pub_key_path, "rb") as p:
                    throttled_response = self.client.post(
                        reverse(self.endpoint),
                        {
                            "owner": self.owner.username,
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(
                                    data, LocalFileEncryptor(p)
                                ).getvalue(),
                                content_type="application/tar",
                            ),
                            "orgs": "testing, foo",
                        },
                        format="multipart",
                    )

        assert initial_response.status_code == 201
        assert throttled_response.status_code == 429
        assert throttled_response.data.get("detail") is not None
        assert (
            throttled_response.data.get("detail")
            == "We've reached our daily limit of relocations - please try again tomorrow or contact support."
        )
        assert Relocation.objects.count() == relocation_count + 1
        assert RelocationFile.objects.count() == relocation_file_count + 1

    def test_success_no_throttle_different_bucket_relocations(self):
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with self.options(
                {
                    "relocation.enabled": True,
                    "relocation.daily-limit-small": 1,
                    "relocation.daily-limit-medium": 1,
                }
            ), open(FRESH_INSTALL_PATH) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    initial_response = self.client.post(
                        reverse(self.endpoint),
                        {
                            "owner": self.owner.username,
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(
                                    data, LocalFileEncryptor(p)
                                ).getvalue(),
                                content_type="application/tar",
                            ),
                            "orgs": "testing, foo",
                        },
                        format="multipart",
                    )

                    # Simulate completion of relocation job
                    relocation = Relocation.objects.all()[0]
                    relocation.status = Relocation.Status.SUCCESS.value
                    relocation.save()
                    relocation.refresh_from_db()

                with open(tmp_pub_key_path, "rb") as p:
                    throttled_response = self.client.post(
                        reverse(self.endpoint),
                        {
                            "owner": self.owner.username,
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(
                                    data, LocalFileEncryptor(p)
                                ).getvalue()
                                * 1000,
                                content_type="application/tar",
                            ),
                            "orgs": "testing, foo",
                        },
                        format="multipart",
                    )

        assert initial_response.status_code == 201
        assert throttled_response.status_code == 201
        assert Relocation.objects.count() == relocation_count + 2
        assert RelocationFile.objects.count() == relocation_file_count + 2

    def test_success_no_throttle_relocation_over_multiple_days(self):
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with self.options(
                {
                    "relocation.enabled": True,
                    "relocation.daily-limit-small": 1,
                }
            ), open(FRESH_INSTALL_PATH) as f, freeze_time("2023-11-28 00:00:00") as frozen_time:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    initial_response = self.client.post(
                        reverse(self.endpoint),
                        {
                            "owner": self.owner.username,
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(
                                    data, LocalFileEncryptor(p)
                                ).getvalue(),
                                content_type="application/tar",
                            ),
                            "orgs": "testing, foo",
                        },
                        format="multipart",
                    )

                    # Simulate completion of relocation job
                    relocation = Relocation.objects.all()[0]
                    relocation.status = Relocation.Status.SUCCESS.value
                    relocation.save()
                    relocation.refresh_from_db()

                frozen_time.shift(timedelta(days=1, minutes=1))

                # Re-login since session has expired
                self.login_as(user=self.superuser, superuser=True)
                with open(tmp_pub_key_path, "rb") as p:
                    throttled_response = self.client.post(
                        reverse(self.endpoint),
                        {
                            "owner": self.owner.username,
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(
                                    data, LocalFileEncryptor(p)
                                ).getvalue(),
                                content_type="application/tar",
                            ),
                            "orgs": "testing, foo",
                        },
                        format="multipart",
                    )

        assert initial_response.status_code == 201
        assert throttled_response.status_code == 201
        assert Relocation.objects.count() == relocation_count + 2
        assert RelocationFile.objects.count() == relocation_file_count + 2
