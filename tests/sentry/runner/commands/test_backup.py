from __future__ import annotations

import tempfile
from pathlib import Path

from click.testing import CliRunner
from django.db import IntegrityError

from sentry.runner.commands.backup import export, import_
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.pytest.fixtures import django_db_all

GOOD_FILE_PATH = get_fixture_path("backup", "fresh-install.json")
BAD_FILE_PATH = get_fixture_path("backup", "corrupted-users.json")
NONEXISTENT_FILE_PATH = get_fixture_path("backup", "does-not-exist.json")


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


@django_db_all(transaction=True)
def test_global_scope():
    cli_import_then_export("global")


@django_db_all(transaction=True)
def test_global_scope_import_overwrite_configs():
    cli_import_then_export("global", import_args=["--overwrite_configs"])


@django_db_all(transaction=True)
def test_config_scope():
    cli_import_then_export("config")


@django_db_all(transaction=True)
def test_config_scope_import_overwrite_configs():
    cli_import_then_export("config", import_args=["--overwrite_configs"])


@django_db_all(transaction=True)
def test_config_scope_export_merge_users():
    cli_import_then_export("config", import_args=["--merge_users"])


@django_db_all(transaction=True)
def test_organization_scope_import_filter_org_slugs():
    cli_import_then_export("organizations", import_args=["--filter_org_slugs", "testing"])


@django_db_all(transaction=True)
def test_organization_scope_export_filter_org_slugs():
    cli_import_then_export("organizations", export_args=["--filter_org_slugs", "testing"])


@django_db_all(transaction=True)
def test_user_scope():
    cli_import_then_export("users")


@django_db_all(transaction=True)
def test_user_scope_export_merge_users():
    cli_import_then_export("users", import_args=["--merge_users"])


@django_db_all(transaction=True)
def test_user_scope_import_filter_usernames():
    cli_import_then_export("users", import_args=["--filter_usernames", "testing@example.com"])


@django_db_all(transaction=True)
def test_user_scope_export_filter_usernames():
    cli_import_then_export("users", export_args=["--filter_usernames", "testing@example.com"])


@django_db_all(transaction=True)
def test_import_integrity_error_exit_code():
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


@django_db_all(transaction=True)
def test_import_file_read_error_exit_code():
    rv = CliRunner().invoke(import_, ["global", NONEXISTENT_FILE_PATH])
    assert not isinstance(rv.exception, IntegrityError)
    assert rv.exit_code == 2, rv.output
