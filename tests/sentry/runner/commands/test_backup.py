from __future__ import annotations

import tempfile
from pathlib import Path

from click.testing import CliRunner

from sentry.backup.helpers import create_encrypted_export_tarball
from sentry.backup.imports import ImportingError
from sentry.runner.commands.backup import compare, export, import_
from sentry.services.hybrid_cloud.import_export.model import RpcImportErrorKind
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.helpers.backups import generate_rsa_key_pair
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.utils import json

GOOD_FILE_PATH = get_fixture_path("backup", "fresh-install.json")
MAX_USER_PATH = get_fixture_path("backup", "user-with-maximum-privileges.json")
MIN_USER_PATH = get_fixture_path("backup", "user-with-minimum-privileges.json")
NONEXISTENT_FILE_PATH = get_fixture_path("backup", "does-not-exist.json")


class GoodCompareCommandTests(TestCase):
    """
    Test success cases of the `sentry compare` CLI command.
    """

    def test_compare_equal(self):
        rv = CliRunner().invoke(compare, [GOOD_FILE_PATH, GOOD_FILE_PATH])
        assert rv.exit_code == 0, rv.output
        assert "found 0" in rv.output

    def test_compare_equal_findings_file(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_findings = Path(tmp_dir).joinpath(f"{self._testMethodName}.findings.json")
            rv = CliRunner().invoke(
                compare, [GOOD_FILE_PATH, GOOD_FILE_PATH, "--findings-file", str(tmp_findings)]
            )
            assert rv.exit_code == 0, rv.output

            with open(tmp_findings) as findings_file:
                findings = json.load(findings_file)
                assert len(findings) == 0

    def test_compare_unequal(self):
        rv = CliRunner().invoke(compare, [MAX_USER_PATH, MIN_USER_PATH])
        assert rv.exit_code == 0, rv.output
        assert "found 0" not in rv.output

    def test_compare_unequal_findings_file(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_findings = Path(tmp_dir).joinpath(f"{self._testMethodName}.findings.json")
            rv = CliRunner().invoke(
                compare, [MAX_USER_PATH, MIN_USER_PATH, "--findings-file", str(tmp_findings)]
            )
            assert rv.exit_code == 0, rv.output

            with open(tmp_findings) as findings_file:
                findings = json.load(findings_file)
                assert len(findings) > 0


def cli_import_then_export(
    scope: str, *, import_args: list[str] | None = None, export_args: list[str] | None = None
):
    rv = CliRunner().invoke(
        import_, [scope, GOOD_FILE_PATH] + ([] if import_args is None else import_args)
    )
    assert rv.exit_code == 0, rv.output

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir).joinpath("good.json")
        rv = CliRunner().invoke(
            export, [scope, str(tmp_path)] + ([] if export_args is None else export_args)
        )
        assert rv.exit_code == 0, rv.output


@region_silo_test(stable=True)
class GoodImportExportCommandTests(TransactionTestCase):
    """
    Test success cases of the `sentry import` and `sentry export` CLI command.
    """

    def test_global_scope(self):
        cli_import_then_export("global")

    def test_global_scope_import_overwrite_configs(self):
        cli_import_then_export("global", import_args=["--overwrite-configs"])

    def test_config_scope(self):
        cli_import_then_export("config")

    def test_config_scope_import_overwrite_configs(self):
        cli_import_then_export("config", import_args=["--overwrite-configs"])

    def test_config_scope_export_merge_users(self):
        cli_import_then_export("config", import_args=["--merge-users"])

    def test_organization_scope_import_filter_org_slugs(self):
        cli_import_then_export("organizations", import_args=["--filter-org-slugs", "testing"])

    def test_organization_scope_export_filter_org_slugs(self):
        cli_import_then_export("organizations", export_args=["--filter-org-slugs", "testing"])

    def test_user_scope(self):
        cli_import_then_export("users")

    def test_user_scope_export_merge_users(self):
        cli_import_then_export("users", import_args=["--merge-users"])

    def test_user_scope_import_filter_usernames(self):
        cli_import_then_export("users", import_args=["--filter-usernames", "testing@example.com"])

    def test_user_scope_export_filter_usernames(self):
        cli_import_then_export("users", export_args=["--filter-usernames", "testing@example.com"])


def cli_encrypted_import_then_export(scope: str):
    with tempfile.TemporaryDirectory() as tmp_dir:
        (priv_key_pem, pub_key_pem) = generate_rsa_key_pair()

        tmp_priv_key_path = Path(tmp_dir).joinpath("key")
        with open(tmp_priv_key_path, "wb") as f:
            f.write(priv_key_pem)

        tmp_pub_key_path = Path(tmp_dir).joinpath("key.pub")
        with open(tmp_pub_key_path, "wb") as f:
            f.write(pub_key_pem)

        with open(GOOD_FILE_PATH) as f:
            data = json.load(f)

        tmp_input_path = Path(tmp_dir).joinpath("input.tar")
        with open(tmp_input_path, "wb") as i, open(tmp_pub_key_path, "rb") as p:
            i.write(create_encrypted_export_tarball(data, p).getvalue())

        rv = CliRunner().invoke(
            import_, [scope, str(tmp_input_path), "--decrypt-with", str(tmp_priv_key_path)]
        )
        assert rv.exit_code == 0, rv.output

        tmp_output_path = Path(tmp_dir).joinpath("output.tar")
        rv = CliRunner().invoke(
            export, [scope, str(tmp_output_path), "--encrypt-with", str(tmp_pub_key_path)]
        )
        assert rv.exit_code == 0, rv.output


class GoodImportExportCommandEncryptionTests(TransactionTestCase):
    """
    Ensure that encryption using an `--encrypt-with` file works as expected.
    """

    def test_global_scope_encryption(self):
        cli_encrypted_import_then_export("global")

    def test_config_scope_encryption(self):
        cli_encrypted_import_then_export("config")

    def test_organization_scope_encryption(self):
        cli_encrypted_import_then_export("organizations")

    def test_user_scope_encryption(self):
        cli_encrypted_import_then_export("users")


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
        with tempfile.TemporaryDirectory() as tmp_dir:
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
        with tempfile.TemporaryDirectory() as tmp_dir:
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

    @assume_test_silo_mode(SiloMode.CONTROL, can_be_monolith=False)
    def test_import_in_control_silo(self):
        rv = CliRunner().invoke(import_, ["global", GOOD_FILE_PATH])
        assert isinstance(rv.exception, RuntimeError)
        assert "Imports must be run in REGION or MONOLITH instances only" in rv.output


# TODO(getsentry/team-ospo#190): Add bad compare tests.
