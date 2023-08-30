from __future__ import annotations

import tempfile
from copy import deepcopy
from functools import cached_property
from pathlib import Path

import pytest
from django.db import IntegrityError

from sentry.backup.helpers import get_exportable_final_derivations_of
from sentry.backup.imports import (
    import_in_global_scope,
    import_in_organization_scope,
    import_in_user_scope,
)
from sentry.backup.scopes import RelocationScope
from sentry.db.models.base import BaseModel
from sentry.models.user import User
from sentry.models.userpermission import UserPermission
from sentry.models.userrole import UserRole, UserRoleUser
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.helpers.backups import (
    NOOP_PRINTER,
    BackupTestCase,
    clear_database_but_keep_sequences,
)
from sentry.utils import json
from tests.sentry.backup import run_backup_tests_only_on_single_db


@run_backup_tests_only_on_single_db
class SanitizationTests(BackupTestCase):
    """
    Ensure that potentially damaging data is properly scrubbed at import time.
    """

    @cached_property
    def json_of_exhaustive_user_with_maximum_privileges(self) -> json.JSONData:
        with open(get_fixture_path("backup", "user-with-maximum-privileges.json")) as backup_file:
            return json.load(backup_file)

    @cached_property
    def json_of_exhaustive_user_with_minimum_privileges(self) -> json.JSONData:
        with open(get_fixture_path("backup", "user-with-minimum-privileges.json")) as backup_file:
            return json.load(backup_file)

    @staticmethod
    def copy_user(exhaustive_user: json.JSONData, username: str) -> json.JSONData:
        user = deepcopy(exhaustive_user)

        for model in user:
            if model["model"] == "sentry.user":
                model["fields"]["username"] = username

        return user

    def generate_tmp_json_file(self, tmp_path) -> json.JSONData:
        """
        Generates a file filled with users with different combinations of admin privileges.
        """

        # A user with the maximal amount of "evil" settings.
        max_user = self.copy_user(self.json_of_exhaustive_user_with_maximum_privileges, "max_user")

        # A user with no "evil" settings.
        min_user = self.copy_user(self.json_of_exhaustive_user_with_minimum_privileges, "min_user")

        # A copy of the `min_user`, but with a maximal `UserPermissions` attached.
        permission_user = self.copy_user(min_user, "permission_user") + deepcopy(
            list(filter(lambda mod: mod["model"] == "sentry.userpermission", max_user))
        )

        # A copy of the `min_user`, but with all of the "evil" flags set to `True`.
        superadmin_user = self.copy_user(min_user, "superadmin_user")
        for model in superadmin_user:
            if model["model"] == "sentry.user":
                model["fields"]["is_staff"] = True
                model["fields"]["is_superuser"] = True

        data = max_user + min_user + permission_user + superadmin_user
        with open(tmp_path, "w+") as tmp_file:
            json.dump(data, tmp_file)

    def test_user_sanitized_in_user_scope(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            self.generate_tmp_json_file(tmp_path)
            with open(tmp_path) as tmp_file:
                import_in_user_scope(tmp_file, NOOP_PRINTER)

        assert User.objects.count() == 4
        assert User.objects.filter(is_staff=False, is_superuser=False).count() == 4

        assert User.objects.filter(is_staff=True).count() == 0
        assert User.objects.filter(is_superuser=True).count() == 0
        assert UserPermission.objects.count() == 0
        assert UserRole.objects.count() == 0
        assert UserRoleUser.objects.count() == 0

    def test_user_sanitized_in_organization_scope(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            self.generate_tmp_json_file(tmp_path)
            with open(tmp_path) as tmp_file:
                import_in_organization_scope(tmp_file, NOOP_PRINTER)

        assert User.objects.count() == 4
        assert User.objects.filter(is_staff=False, is_superuser=False).count() == 4

        assert User.objects.filter(is_staff=True).count() == 0
        assert User.objects.filter(is_superuser=True).count() == 0
        assert UserPermission.objects.count() == 0
        assert UserRole.objects.count() == 0
        assert UserRoleUser.objects.count() == 0

    def test_users_sanitized_in_global_scope(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            self.generate_tmp_json_file(tmp_path)
            with open(tmp_path) as tmp_file:
                import_in_global_scope(tmp_file, NOOP_PRINTER)

        assert User.objects.count() == 4
        assert User.objects.filter(is_staff=True).count() == 2
        assert User.objects.filter(is_superuser=True).count() == 2
        assert User.objects.filter(is_staff=False, is_superuser=False).count() == 2

        # 1 from `max_user`, 1 from `permission_user`.
        assert UserPermission.objects.count() == 2

        # 1 from `max_user`.
        assert UserRole.objects.count() == 1
        assert UserRoleUser.objects.count() == 1

    # TODO(getsentry/team-ospo#181): Should fix this behavior to handle duplicate
    def test_bad_already_taken_username(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            self.create_user("testing@example.com")
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            with open(tmp_path, "w+") as tmp_file:
                json.dump(self.json_of_exhaustive_user_with_minimum_privileges, tmp_file)

            with open(tmp_path) as tmp_file:
                with pytest.raises(IntegrityError):
                    import_in_user_scope(tmp_file, NOOP_PRINTER)


@run_backup_tests_only_on_single_db
class ScopingTests(BackupTestCase):
    """
    Ensures that only models with the allowed relocation scopes are actually imported.
    """

    def test_user_import_scoping(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            self.create_exhaustive_instance(is_superadmin=True)
            data = self.import_export_then_validate(self._testMethodName, reset_pks=True)
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            with open(tmp_path, "w+") as tmp_file:
                json.dump(data, tmp_file)

            clear_database_but_keep_sequences()
            with open(tmp_path) as tmp_file:
                import_in_user_scope(tmp_file, NOOP_PRINTER)
                for model in get_exportable_final_derivations_of(BaseModel):
                    if model.__relocation_scope__ != RelocationScope.User:
                        assert model.objects.count() == 0

    def test_organization_import_scoping(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            self.create_exhaustive_instance(is_superadmin=True)
            data = self.import_export_then_validate(self._testMethodName, reset_pks=True)
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            with open(tmp_path, "w+") as tmp_file:
                json.dump(data, tmp_file)

            clear_database_but_keep_sequences()
            with open(tmp_path) as tmp_file:
                import_in_organization_scope(tmp_file, NOOP_PRINTER)
                for model in get_exportable_final_derivations_of(BaseModel):
                    if model.__relocation_scope__ not in {
                        RelocationScope.User,
                        RelocationScope.Organization,
                    }:
                        assert model.objects.count() == 0
