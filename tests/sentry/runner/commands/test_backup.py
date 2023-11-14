from __future__ import annotations

from pathlib import Path
from random import choice
from string import ascii_letters
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

from click.testing import CliRunner
from google_crc32c import value as crc32c

from sentry.backup.helpers import (
    DecryptionError,
    EncryptionError,
    LocalFileDecryptor,
    LocalFileEncryptor,
    create_encrypted_export_tarball,
    unwrap_encrypted_export_tarball,
)
from sentry.backup.imports import ImportingError
from sentry.runner.commands.backup import backup, export, import_
from sentry.services.hybrid_cloud.import_export.model import RpcImportErrorKind
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.helpers.backups import (
    FakeKeyManagementServiceClient,
    clear_database,
    generate_rsa_key_pair,
)
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.utils import json

GOOD_FILE_PATH = get_fixture_path("backup", "fresh-install.json")
MAX_USER_PATH = get_fixture_path("backup", "user-with-maximum-privileges.json")
MIN_USER_PATH = get_fixture_path("backup", "user-with-minimum-privileges.json")
NONEXISTENT_FILE_PATH = get_fixture_path("backup", "does-not-exist.json")


def create_encryption_key_files(tmp_dir: str) -> tuple[Path, Path]:
    """
    Returns a 2-tuple with the path to the private key file and public key file.
    """

    (priv_key_pem, pub_key_pem) = generate_rsa_key_pair()

    tmp_priv_key_path = Path(tmp_dir).joinpath("key")
    with open(tmp_priv_key_path, "wb") as f:
        f.write(priv_key_pem)

    tmp_pub_key_path = Path(tmp_dir).joinpath("key.pub")
    with open(tmp_pub_key_path, "wb") as f:
        f.write(pub_key_pem)

    return (tmp_priv_key_path, tmp_pub_key_path)


def create_encryption_test_files(tmp_dir: str) -> tuple[Path, Path, Path]:
    """
    Returns a 3-tuple with the path to the private key file, public key file, and final tarball.
    """

    (tmp_priv_key_path, tmp_pub_key_path) = create_encryption_key_files(tmp_dir)
    with open(GOOD_FILE_PATH) as f:
        data = json.load(f)

    tmp_tar_path = Path(tmp_dir).joinpath("input.tar")
    with open(tmp_tar_path, "wb") as i, open(tmp_pub_key_path, "rb") as p:
        i.write(create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue())

    return (tmp_priv_key_path, tmp_pub_key_path, tmp_tar_path)


class GoodCompareCommandTests(TestCase):
    """
    Test success cases of the `sentry backup compare` CLI command.
    """

    def test_compare_equal(self):
        rv = CliRunner().invoke(backup, ["compare", GOOD_FILE_PATH, GOOD_FILE_PATH])
        assert rv.exit_code == 0, rv.output
        assert "found 0" in rv.output

    def test_compare_equal_findings_file(self):
        with TemporaryDirectory() as tmp_dir:
            tmp_findings = Path(tmp_dir).joinpath(f"{self._testMethodName}.findings.json")
            rv = CliRunner().invoke(
                backup,
                ["compare", GOOD_FILE_PATH, GOOD_FILE_PATH, "--findings-file", str(tmp_findings)],
            )
            assert rv.exit_code == 0, rv.output

            with open(tmp_findings) as findings_file:
                findings = json.load(findings_file)
                assert len(findings) == 0

    def test_compare_unequal(self):
        rv = CliRunner().invoke(backup, ["compare", MAX_USER_PATH, MIN_USER_PATH])
        assert rv.exit_code == 0, rv.output
        assert "found 0" not in rv.output

    def test_compare_unequal_findings_file(self):
        with TemporaryDirectory() as tmp_dir:
            tmp_findings = Path(tmp_dir).joinpath(f"{self._testMethodName}.findings.json")
            rv = CliRunner().invoke(
                backup,
                ["compare", MAX_USER_PATH, MIN_USER_PATH, "--findings-file", str(tmp_findings)],
            )
            assert rv.exit_code == 0, rv.output

            with open(tmp_findings) as findings_file:
                findings = json.load(findings_file)
                assert len(findings) > 0


class GoodCompareCommandEncryptionTests(TestCase):
    """
    Test success cases of the `sentry compare` CLI command on encrypted inputs.
    """

    def mock_gcp_kms_asymmetric_decrypt(
        self,
        tmp_dir: str,
        tmp_priv_key_path: Path,
        tmp_encrypted_path: Path,
        fake_kms_client: FakeKeyManagementServiceClient,
    ) -> Path:
        with open(tmp_encrypted_path, "rb") as f:
            unwrapped_tarball = unwrap_encrypted_export_tarball(f)
        with open(tmp_priv_key_path, "rb") as f:
            plaintext_dek = LocalFileDecryptor(f).decrypt_data_encryption_key(unwrapped_tarball)
            fake_kms_client.asymmetric_decrypt.return_value = SimpleNamespace(
                plaintext=plaintext_dek,
                plaintext_crc32c=crc32c(plaintext_dek),
            )

        gcp_kms_config_path = Path(tmp_dir).joinpath("config.json")
        with open(gcp_kms_config_path, "w") as f:
            f.write(
                """
                {
                    "project_id": "test-google-cloud-project",
                    "location": "global",
                    "key_ring": "test-key-ring-name",
                    "key": "test-key-name",
                    "version": "1"
                }
                """
            )

        return gcp_kms_config_path

    def test_compare_decrypt_with(self):
        with TemporaryDirectory() as tmp_dir:
            (tmp_priv_key_path, _, tmp_encrypted_path) = create_encryption_test_files(tmp_dir)
            tmp_findings = Path(tmp_dir).joinpath(f"{self._testMethodName}.findings.json")

            cases = [
                # Only left-side encrypted.
                [
                    "compare",
                    str(tmp_encrypted_path),
                    GOOD_FILE_PATH,
                    "--findings-file",
                    str(tmp_findings),
                    "--decrypt-left-with",
                    str(tmp_priv_key_path),
                ],
                # Only right-side encrypted.
                [
                    "compare",
                    GOOD_FILE_PATH,
                    str(tmp_encrypted_path),
                    "--findings-file",
                    str(tmp_findings),
                    "--decrypt-right-with",
                    str(tmp_priv_key_path),
                ],
                # Both sides encrypted.
                [
                    "compare",
                    str(tmp_encrypted_path),
                    str(tmp_encrypted_path),
                    "--findings-file",
                    str(tmp_findings),
                    "--decrypt-left-with",
                    str(tmp_priv_key_path),
                    "--decrypt-right-with",
                    str(tmp_priv_key_path),
                ],
            ]

            for args in cases:
                rv = CliRunner().invoke(backup, args)
                assert rv.exit_code == 0, rv.output

                with open(tmp_findings) as findings_file:
                    findings = json.load(findings_file)
                    assert len(findings) == 0

    @patch(
        "sentry.backup.helpers.KeyManagementServiceClient",
        new_callable=lambda: FakeKeyManagementServiceClient,
    )
    def test_compare_decrypt_with_gcp_kms(self, fake_kms_client: FakeKeyManagementServiceClient):
        with TemporaryDirectory() as tmp_dir:
            (tmp_priv_key_path, _, tmp_encrypted_path) = create_encryption_test_files(tmp_dir)
            gcp_kms_config_path = self.mock_gcp_kms_asymmetric_decrypt(
                tmp_dir, tmp_priv_key_path, tmp_encrypted_path, fake_kms_client
            )
            tmp_findings = Path(tmp_dir).joinpath(f"{self._testMethodName}.findings.json")

            cases = [
                # Only left-side encrypted.
                [
                    "compare",
                    str(tmp_encrypted_path),
                    GOOD_FILE_PATH,
                    "--findings-file",
                    str(tmp_findings),
                    "--decrypt-left-with-gcp-kms",
                    str(gcp_kms_config_path),
                ],
                # Only right-side encrypted.
                [
                    "compare",
                    GOOD_FILE_PATH,
                    str(tmp_encrypted_path),
                    "--findings-file",
                    str(tmp_findings),
                    "--decrypt-right-with-gcp-kms",
                    str(gcp_kms_config_path),
                ],
                # Both sides encrypted.
                [
                    "compare",
                    str(tmp_encrypted_path),
                    str(tmp_encrypted_path),
                    "--findings-file",
                    str(tmp_findings),
                    "--decrypt-left-with-gcp-kms",
                    str(gcp_kms_config_path),
                    "--decrypt-right-with-gcp-kms",
                    str(gcp_kms_config_path),
                ],
            ]

            for args in cases:
                fake_kms_client.asymmetric_decrypt.call_count = 0
                rv = CliRunner().invoke(backup, args)
                assert rv.exit_code == 0, rv.output

                with open(tmp_findings) as findings_file:
                    findings = json.load(findings_file)
                    assert len(findings) == 0
                    assert fake_kms_client.asymmetric_decrypt.call_count == len(
                        [arg for arg in args if arg == str(gcp_kms_config_path)]
                    )


class GoodEncryptDecryptCommandTests(TransactionTestCase):
    """
    Test the `sentry backup encrypt ...` and `sentry backup decrypt` commands
    """

    def test_use_local(self):
        with TemporaryDirectory() as tmp_dir:
            tmp_decrypted_path = Path(tmp_dir).joinpath("decrypted.tar")
            tmp_encrypted_path = Path(tmp_dir).joinpath("encrypted.tar")
            (tmp_priv_key_path, tmp_pub_key_path) = create_encryption_key_files(tmp_dir)

            rv = CliRunner().invoke(
                backup,
                [
                    "encrypt",
                    str(tmp_encrypted_path),
                    "--src",
                    GOOD_FILE_PATH,
                    "--encrypt-with",
                    str(tmp_pub_key_path),
                ],
            )
            assert rv.exit_code == 0, rv.output

            rv = CliRunner().invoke(
                backup,
                [
                    "decrypt",
                    str(tmp_decrypted_path),
                    "--src",
                    str(tmp_encrypted_path),
                    "--decrypt-with",
                    str(tmp_priv_key_path),
                ],
            )
            assert rv.exit_code == 0, rv.output

            with open(GOOD_FILE_PATH, "rb") as source, open(tmp_decrypted_path, "rb") as target:
                source_json = json.load(source)
                target_json = json.load(target)
                assert source_json == target_json

    @patch(
        "sentry.backup.helpers.KeyManagementServiceClient",
        new_callable=lambda: FakeKeyManagementServiceClient,
    )
    def test_use_gcp_kms(self, fake_kms_client: FakeKeyManagementServiceClient):
        fake_kms_client.asymmetric_decrypt.call_count = 0
        fake_kms_client.get_public_key.call_count = 0

        with TemporaryDirectory() as tmp_dir:
            tmp_decrypted_path = Path(tmp_dir).joinpath("decrypted.tar")
            tmp_encrypted_path = Path(tmp_dir).joinpath("encrypted.tar")
            (tmp_priv_key_path, tmp_pub_key_path) = create_encryption_key_files(tmp_dir)
            gcp_kms_config_path = Path(tmp_dir).joinpath("config.json")
            with open(gcp_kms_config_path, "w") as f:
                f.write(
                    """
                    {
                        "project_id": "test-google-cloud-project",
                        "location": "global",
                        "key_ring": "test-key-ring-name",
                        "key": "test-key-name",
                        "version": "1"
                    }
                    """
                )

            # Mock out the GCP KMS reply for the public key retrieval.
            with open(tmp_pub_key_path, "rb") as f:
                fake_kms_client.get_public_key.return_value = SimpleNamespace(
                    pem=f.read().decode("utf-8")
                )

            rv = CliRunner().invoke(
                backup,
                [
                    "encrypt",
                    str(tmp_encrypted_path),
                    "--src",
                    GOOD_FILE_PATH,
                    "--encrypt-with-gcp-kms",
                    str(gcp_kms_config_path),
                ],
            )
            assert rv.exit_code == 0, rv.output

            # Mock out the GCP KMS reply by decrypting the DEK here.
            with open(tmp_encrypted_path, "rb") as f:
                unwrapped_tarball = unwrap_encrypted_export_tarball(f)
            with open(tmp_priv_key_path, "rb") as f:
                plaintext_dek = LocalFileDecryptor(f).decrypt_data_encryption_key(unwrapped_tarball)
                fake_kms_client.asymmetric_decrypt.return_value = SimpleNamespace(
                    plaintext=plaintext_dek,
                    plaintext_crc32c=crc32c(plaintext_dek),
                )

            rv = CliRunner().invoke(
                backup,
                [
                    "decrypt",
                    str(tmp_decrypted_path),
                    "--src",
                    str(tmp_encrypted_path),
                    "--decrypt-with-gcp-kms",
                    str(gcp_kms_config_path),
                ],
            )
            assert rv.exit_code == 0, rv.output
            assert fake_kms_client.asymmetric_decrypt.call_count == 1

            with open(GOOD_FILE_PATH, "rb") as source, open(tmp_decrypted_path, "rb") as target:
                source_json = json.load(source)
                target_json = json.load(target)
                assert source_json == target_json


def cli_import_then_export(
    scope: str, *, import_args: list[str] | None = None, export_args: list[str] | None = None
):
    with TemporaryDirectory() as tmp_dir:
        tmp_in_findings = Path(tmp_dir).joinpath(
            f"{''.join(choice(ascii_letters)for _ in range(6))}.json"
        )
        rv = CliRunner().invoke(
            import_,
            [scope, GOOD_FILE_PATH, "--findings-file", str(tmp_in_findings)]
            + ([] if import_args is None else import_args),
        )
        assert rv.exit_code == 0, rv.output
        with open(tmp_in_findings) as f:
            findings = json.load(f)
            assert len(findings) == 0

        tmp_out_findings = Path(tmp_dir).joinpath(
            f"{''.join(choice(ascii_letters)for _ in range(6))}.json"
        )
        tmp_out_path = Path(tmp_dir).joinpath("good.json")
        rv = CliRunner().invoke(
            export,
            [scope, str(tmp_out_path), "--findings-file", str(tmp_out_findings)]
            + ([] if export_args is None else export_args),
        )
        assert rv.exit_code == 0, rv.output
        with open(tmp_out_findings) as f:
            findings = json.load(f)
            assert len(findings) == 0


@region_silo_test(stable=True)
class GoodImportExportCommandTests(TransactionTestCase):
    """
    Test success cases of the `sentry import` and `sentry export` CLI command. We're not asserting
    against the content of any of the imports/exports (we have other tests for that in
    `tests/sentry/backup`), we just want to make sure invoking all reasonable variants of the
    commands occurs without error.
    """

    def test_global_scope(self):
        cli_import_then_export("global")

        # Global imports assume a clean database.
        clear_database()
        cli_import_then_export("global", import_args=["--overwrite-configs"])

    def test_config_scope(self):
        cli_import_then_export("config")
        cli_import_then_export("config", import_args=["--overwrite-configs"])
        cli_import_then_export("config", import_args=["--merge-users"])
        cli_import_then_export("config", import_args=["--overwrite-configs", "--merge-users"])

    def test_organization_scope(self):
        cli_import_then_export("organizations")
        cli_import_then_export(
            "organizations",
            import_args=["--filter-org-slugs", "testing"],
            export_args=["--filter-org-slugs", "testing"],
        )

    def test_user_scope(self):
        cli_import_then_export("users")
        cli_import_then_export("users", import_args=["--merge-users"])
        cli_import_then_export(
            "users",
            import_args=["--filter-usernames", "testing@example.com"],
            export_args=["--filter-usernames", "testing@example.com"],
        )


class GoodImportExportCommandEncryptionTests(TransactionTestCase):
    """
    Ensure that encryption using an `--encrypt-with`/`--encrypt-with-gcp-kms` flag and decryption
    using a `decrypt-with`/`decrypt-with-gcp-kms` works as expected.
    """

    @staticmethod
    def cli_encrypted_import_then_export_use_local(scope: str):
        with TemporaryDirectory() as tmp_dir:
            (tmp_priv_key_path, tmp_pub_key_path, tmp_tar_path) = create_encryption_test_files(
                tmp_dir
            )
            rv = CliRunner().invoke(
                import_, [scope, str(tmp_tar_path), "--decrypt-with", str(tmp_priv_key_path)]
            )
            assert rv.exit_code == 0, rv.output

            tmp_output_path = Path(tmp_dir).joinpath("output.tar")
            rv = CliRunner().invoke(
                export, [scope, str(tmp_output_path), "--encrypt-with", str(tmp_pub_key_path)]
            )
            assert rv.exit_code == 0, rv.output

    @staticmethod
    def cli_encrypted_import_then_export_use_gcp_kms(
        scope: str, fake_kms_client: FakeKeyManagementServiceClient
    ):
        fake_kms_client.asymmetric_decrypt.call_count = 0
        with TemporaryDirectory() as tmp_dir:
            (tmp_priv_key_path, tmp_pub_key_path, tmp_tar_path) = create_encryption_test_files(
                tmp_dir
            )

            # Mock out the GCP KMS replies.
            with open(tmp_tar_path, "rb") as f:
                unwrapped_tarball = unwrap_encrypted_export_tarball(f)
            with open(tmp_priv_key_path, "rb") as f:
                plaintext_dek = LocalFileDecryptor(f).decrypt_data_encryption_key(unwrapped_tarball)
                fake_kms_client.asymmetric_decrypt.return_value = SimpleNamespace(
                    plaintext=plaintext_dek,
                    plaintext_crc32c=crc32c(plaintext_dek),
                )
            with open(tmp_pub_key_path, "rb") as f:
                fake_kms_client.get_public_key.return_value = SimpleNamespace(
                    pem=f.read().decode("utf-8")
                )

            gcp_kms_config_path = Path(tmp_dir).joinpath("config.json")
            with open(gcp_kms_config_path, "w") as f:
                f.write(
                    """
                    {
                        "project_id": "test-google-cloud-project",
                        "location": "global",
                        "key_ring": "test-key-ring-name",
                        "key": "test-key-name",
                        "version": "1"
                    }
                    """
                )

            rv = CliRunner().invoke(
                import_,
                [
                    scope,
                    str(tmp_tar_path),
                    "--decrypt-with-gcp-kms",
                    str(gcp_kms_config_path),
                ],
            )
            assert rv.exit_code == 0, rv.output
            assert fake_kms_client.asymmetric_decrypt.call_count == 1

            tmp_output_path = Path(tmp_dir).joinpath("output.tar")
            rv = CliRunner().invoke(
                export,
                [scope, str(tmp_output_path), "--encrypt-with-gcp-kms", str(gcp_kms_config_path)],
            )
            assert rv.exit_code == 0, rv.output

    def test_encryption_with_local_decryption(self):
        self.cli_encrypted_import_then_export_use_local("global")
        self.cli_encrypted_import_then_export_use_local("config")
        self.cli_encrypted_import_then_export_use_local("organizations")
        self.cli_encrypted_import_then_export_use_local("users")

    @patch(
        "sentry.backup.helpers.KeyManagementServiceClient",
        new_callable=lambda: FakeKeyManagementServiceClient,
    )
    def test_encryption_with_gcp_kms_decryption(
        self, fake_kms_client: FakeKeyManagementServiceClient
    ):
        self.cli_encrypted_import_then_export_use_gcp_kms("global", fake_kms_client)
        self.cli_encrypted_import_then_export_use_gcp_kms("config", fake_kms_client)
        self.cli_encrypted_import_then_export_use_gcp_kms("organizations", fake_kms_client)
        self.cli_encrypted_import_then_export_use_gcp_kms("users", fake_kms_client)


class BadImportExportDomainErrorTests(TransactionTestCase):
    def test_import_integrity_error_exit_code(self):
        # First import should succeed.
        rv = CliRunner().invoke(import_, ["global", GOOD_FILE_PATH])
        assert rv.exit_code == 0, rv.output

        # Global imports assume an empty DB, so this should fail with an `IntegrityError`.
        rv = CliRunner().invoke(import_, ["global", GOOD_FILE_PATH])
        assert (
            ">> Are you restoring from a backup of the same version of Sentry?\n>> Are you restoring onto a clean database?\n>> If so then this IntegrityError might be our fault, you can open an issue here:\n>> https://github.com/getsentry/sentry/issues/new/choose\n"
            in rv.output
        )
        assert isinstance(rv.exception, ImportingError)
        assert rv.exception.context.get_kind() == RpcImportErrorKind.IntegrityError
        assert rv.exit_code == 1, rv.output


class BadImportExportCommandTests(TestCase):
    def test_import_invalid_json(self):
        with TemporaryDirectory() as tmp_dir:
            tmp_invalid_json = Path(tmp_dir).joinpath(f"{self._testMethodName}.invalid.json")
            with open(get_fixture_path("backup", "single-option.json")) as backup_file:
                models = json.load(backup_file)
                models[0]["fields"]["invalid_field"] = "invalid_data"
                with open(tmp_invalid_json, "w") as invalid_input_file:
                    json.dump(models, invalid_input_file)

            for scope in {"users", "organizations", "config", "global"}:
                tmp_findings = Path(tmp_dir).joinpath(
                    f"{self._testMethodName}.{scope}.findings.json"
                )
                rv = CliRunner().invoke(
                    import_, [scope, str(tmp_invalid_json), "--findings-file", str(tmp_findings)]
                )
                assert rv.exit_code == 1, rv.output

                with open(tmp_findings) as findings_file:
                    findings = json.load(findings_file)
                    assert len(findings) == 1
                    assert findings[0]["finding"] == "RpcImportError"
                    assert findings[0]["kind"] == "DeserializationFailed"

    def test_import_file_read_error_exit_code(self):
        rv = CliRunner().invoke(import_, ["global", NONEXISTENT_FILE_PATH])
        assert not isinstance(rv.exception, ImportingError)
        assert rv.exit_code == 2, rv.output

    @assume_test_silo_mode(SiloMode.CONTROL, can_be_monolith=False)
    def test_export_in_control_silo(self):
        rv = CliRunner().invoke(export, ["global", NONEXISTENT_FILE_PATH])
        assert isinstance(rv.exception, RuntimeError)
        assert "Exports must be run in REGION or MONOLITH instances only" in rv.output

    def test_export_invalid_public_key(self):
        with TemporaryDirectory() as tmp_dir:
            tmp_pub_key_path = Path(tmp_dir).joinpath("key.pub")
            with open(tmp_pub_key_path, "w") as f:
                f.write("this is an invalid public key")

            tmp_out_path = Path(tmp_dir).joinpath("bad.json")
            rv = CliRunner().invoke(
                export, ["global", str(tmp_out_path), "--encrypt-with", str(tmp_pub_key_path)]
            )
            assert isinstance(rv.exception, ValueError)
            assert rv.exit_code == 1
            assert "Could not deserialize" in str(rv.exception)

    def test_export_invalid_gcp_kms_config(self):
        with TemporaryDirectory() as tmp_dir:
            (_, _, tmp_tar_path) = create_encryption_test_files(tmp_dir)
            gcp_kms_config_path = Path(tmp_dir).joinpath("config.json")
            with open(gcp_kms_config_path, "w") as f:
                f.write(
                    """
                    {
                        "project_id": "test-google-cloud-project",
                        "location": "global",
                        "key_ring": "test-key-ring-name",
                        "key": "test-key-name",
                        "version_is_misspelled_and_has_int_instead_of_string": 1
                    }
                    """
                )

            rv = CliRunner().invoke(
                export,
                ["global", str(tmp_tar_path), "--encrypt-with-gcp-kms", str(gcp_kms_config_path)],
            )
            assert isinstance(rv.exception, EncryptionError)
            assert rv.exit_code == 1

    @assume_test_silo_mode(SiloMode.CONTROL, can_be_monolith=False)
    def test_import_in_control_silo(self):
        rv = CliRunner().invoke(import_, ["global", GOOD_FILE_PATH])
        assert isinstance(rv.exception, RuntimeError)
        assert "Imports must be run in REGION or MONOLITH instances only" in rv.output

    def test_import_invalid_public_key(self):
        with TemporaryDirectory() as tmp_dir:
            (_, _, tmp_tar_path) = create_encryption_test_files(tmp_dir)
            tmp_priv_key_path = Path(tmp_dir).joinpath("key")
            with open(tmp_priv_key_path, "w") as f:
                f.write("this is an invalid private key")

            rv = CliRunner().invoke(
                import_, ["global", str(tmp_tar_path), "--decrypt-with", str(tmp_priv_key_path)]
            )
            assert isinstance(rv.exception, ValueError)
            assert rv.exit_code == 1
            assert "Could not deserialize" in str(rv.exception)

    def test_import_unreadable_gcp_kms_config(self):
        with TemporaryDirectory() as tmp_dir:
            (_, _, tmp_tar_path) = create_encryption_test_files(tmp_dir)
            gcp_kms_config_path = Path(tmp_dir).joinpath("config.json")
            with open(gcp_kms_config_path, "w") as f:
                f.write("this is clearly not valid JSON")

            rv = CliRunner().invoke(
                import_,
                ["global", str(tmp_tar_path), "--decrypt-with-gcp-kms", str(gcp_kms_config_path)],
            )
            assert isinstance(rv.exception, json.JSONDecodeError)
            assert rv.exit_code == 1

    def test_import_invalid_gcp_kms_config(self):
        with TemporaryDirectory() as tmp_dir:
            (_, _, tmp_tar_path) = create_encryption_test_files(tmp_dir)
            gcp_kms_config_path = Path(tmp_dir).joinpath("config.json")
            with open(gcp_kms_config_path, "w") as f:
                f.write(
                    """
                    {
                        "project_id": "test-google-cloud-project",
                        "location": "global",
                        "key_ring": "test-key-ring-name",
                        "key": "test-key-name",
                        "version_is_misspelled_and_has_int_instead_of_string": 1
                    }
                    """
                )

            rv = CliRunner().invoke(
                import_,
                ["global", str(tmp_tar_path), "--decrypt-with-gcp-kms", str(gcp_kms_config_path)],
            )
            assert isinstance(rv.exception, DecryptionError)
            assert rv.exit_code == 1


# TODO(getsentry/team-ospo#190): Add bad compare tests.
