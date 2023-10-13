from __future__ import annotations

import tempfile
from pathlib import Path

from click.testing import CliRunner
from django.db import IntegrityError

from sentry.runner.commands.backup import compare, export, import_
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.helpers.backups import generate_rsa_key_pair
from sentry.testutils.silo import assume_test_silo_mode
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
                compare, [GOOD_FILE_PATH, GOOD_FILE_PATH, "--findings_file", str(tmp_findings)]
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
                compare, [MAX_USER_PATH, MIN_USER_PATH, "--findings_file", str(tmp_findings)]
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


class GoodImportExportCommandTests(TransactionTestCase):
    """
    Test success cases of the `sentry import` and `sentry export` CLI command.
    """

    def test_global_scope(self):
        cli_import_then_export("global")

    def test_global_scope_import_overwrite_configs(self):
        cli_import_then_export("global", import_args=["--overwrite_configs"])

    def test_config_scope(self):
        cli_import_then_export("config")

    def test_config_scope_import_overwrite_configs(self):
        cli_import_then_export("config", import_args=["--overwrite_configs"])

    def test_config_scope_export_merge_users(self):
        cli_import_then_export("config", import_args=["--merge_users"])

    def test_organization_scope_import_filter_org_slugs(self):
        cli_import_then_export("organizations", import_args=["--filter_org_slugs", "testing"])

    def test_organization_scope_export_filter_org_slugs(self):
        cli_import_then_export("organizations", export_args=["--filter_org_slugs", "testing"])

    def test_user_scope(self):
        cli_import_then_export("users")

    def test_user_scope_export_merge_users(self):
        cli_import_then_export("users", import_args=["--merge_users"])

    def test_user_scope_import_filter_usernames(self):
        cli_import_then_export("users", import_args=["--filter_usernames", "testing@example.com"])

    def test_user_scope_export_filter_usernames(self):
        cli_import_then_export("users", export_args=["--filter_usernames", "testing@example.com"])


class GoodImportExportCommandEncryptionTests(TransactionTestCase):
    """
    Ensure that encryption using an `--encrypt_with` file works as expected.
    """

    def encryption_export_args(self, tmp_dir) -> list[str]:
        tmp_pub_key_path = Path(tmp_dir).joinpath("key.pub")
        (_, public_key_pem) = generate_rsa_key_pair()
        public_key_str = public_key_pem.decode("utf-8")
        with open(tmp_pub_key_path, "w") as f:
            f.write(public_key_str)
        return ["--encrypt_with", str(tmp_pub_key_path)]

    def test_global_scope_encryption(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            cli_import_then_export("global", export_args=self.encryption_export_args(tmp_dir))

    def test_config_scope_encryption(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            cli_import_then_export("config", export_args=self.encryption_export_args(tmp_dir))

    def test_organization_scope_encryption(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            cli_import_then_export(
                "organizations", export_args=self.encryption_export_args(tmp_dir)
            )

    def test_user_scope_encryption(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            cli_import_then_export("users", export_args=self.encryption_export_args(tmp_dir))


class BadImportExportDomainErrorTests(TransactionTestCase):
    def test_import_integrity_error_exit_code(self):
        # First import should succeed.
        rv = CliRunner().invoke(import_, ["global", GOOD_FILE_PATH] + [])
        assert rv.exit_code == 0, rv.output

        # Global imports assume an empty DB, so this should fail with an `IntegrityError`.
        rv = CliRunner().invoke(import_, ["global", GOOD_FILE_PATH])
        assert (
            ">> Are you restoring from a backup of the same version of Sentry?\n>> Are you restoring onto a clean database?\n>> If so then this IntegrityError might be our fault, you can open an issue here:\n>> https://github.com/getsentry/sentry/issues/new/choose\n"
            in rv.output
        )
        assert isinstance(rv.exception, IntegrityError)
        assert rv.exit_code == 1, rv.output


class BadImportExportCommandTests(TestCase):
    def test_import_file_read_error_exit_code(self):
        rv = CliRunner().invoke(import_, ["global", NONEXISTENT_FILE_PATH])
        assert not isinstance(rv.exception, IntegrityError)
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
                export, ["global", str(tmp_out_path), "--encrypt_with", str(tmp_pub_key_path)]
            )
            assert isinstance(rv.exception, ValueError)
            assert rv.exit_code == 1
            assert "Could not deserialize" in str(rv.exception)
