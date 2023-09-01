from __future__ import annotations

import tempfile
from copy import deepcopy
from functools import cached_property
from pathlib import Path

import pytest
from django.db import IntegrityError

from sentry.backup.helpers import get_exportable_sentry_models
from sentry.backup.imports import (
    import_in_global_scope,
    import_in_organization_scope,
    import_in_user_scope,
)
from sentry.backup.scopes import ExportScope, RelocationScope
from sentry.models.authenticator import Authenticator
from sentry.models.email import Email
from sentry.models.organization import Organization
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.models.user import User
from sentry.models.useremail import UserEmail
from sentry.models.userip import UserIP
from sentry.models.userpermission import UserPermission
from sentry.models.userrole import UserRole, UserRoleUser
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.helpers.backups import (
    NOOP_PRINTER,
    BackupTestCase,
    clear_database,
    export_to_file,
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
                import_in_user_scope(tmp_file, printer=NOOP_PRINTER)

        assert User.objects.count() == 4
        assert User.objects.filter(is_staff=False, is_superuser=False).count() == 4

        assert User.objects.filter(is_staff=True).count() == 0
        assert User.objects.filter(is_superuser=True).count() == 0
        assert Authenticator.objects.count() == 0
        assert UserPermission.objects.count() == 0
        assert UserRole.objects.count() == 0
        assert UserRoleUser.objects.count() == 0

    def test_user_sanitized_in_organization_scope(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            self.generate_tmp_json_file(tmp_path)
            with open(tmp_path) as tmp_file:
                import_in_organization_scope(tmp_file, printer=NOOP_PRINTER)

        assert User.objects.count() == 4
        assert User.objects.filter(is_staff=False, is_superuser=False).count() == 4

        assert User.objects.filter(is_staff=True).count() == 0
        assert User.objects.filter(is_superuser=True).count() == 0
        assert Authenticator.objects.count() == 0
        assert UserPermission.objects.count() == 0
        assert UserRole.objects.count() == 0
        assert UserRoleUser.objects.count() == 0

    def test_users_sanitized_in_global_scope(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            self.generate_tmp_json_file(tmp_path)
            with open(tmp_path) as tmp_file:
                import_in_global_scope(tmp_file, printer=NOOP_PRINTER)

        assert User.objects.count() == 4
        assert User.objects.filter(is_staff=True).count() == 2
        assert User.objects.filter(is_superuser=True).count() == 2
        assert User.objects.filter(is_staff=False, is_superuser=False).count() == 2
        assert Authenticator.objects.count() == 4

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
                    import_in_user_scope(tmp_file, printer=NOOP_PRINTER)


class ImportTestCase(BackupTestCase):
    def export_to_tmp_file_and_clear_database(self, tmp_dir) -> Path:
        tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
        export_to_file(tmp_path, ExportScope.Global)
        clear_database()
        return tmp_path


@run_backup_tests_only_on_single_db
class ScopingTests(ImportTestCase):
    """
    Ensures that only models with the allowed relocation scopes are actually imported.
    """

    def test_user_import_scoping(self):
        self.create_exhaustive_instance(is_superadmin=True)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path) as tmp_file:
                import_in_user_scope(tmp_file, printer=NOOP_PRINTER)
                exportable = get_exportable_sentry_models()
                for model in exportable:
                    if model.__relocation_scope__ != RelocationScope.User:
                        assert model.objects.count() == 0

    def test_organization_import_scoping(self):
        self.create_exhaustive_instance(is_superadmin=True)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path) as tmp_file:
                import_in_organization_scope(tmp_file, printer=NOOP_PRINTER)
                exportable = get_exportable_sentry_models()
                for model in exportable:
                    if model.__relocation_scope__ not in {
                        RelocationScope.User,
                        RelocationScope.Organization,
                    }:
                        assert model.objects.count() == 0


@run_backup_tests_only_on_single_db
class FilterTests(ImportTestCase):
    """
    Ensures that filtering operations include the correct models.
    """

    def test_import_filter_users(self):
        self.create_exhaustive_user("user_1")
        self.create_exhaustive_user("user_2")

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path) as tmp_file:
                import_in_user_scope(tmp_file, user_filter={"user_2"}, printer=NOOP_PRINTER)

        # Count users, but also count a random model naively derived from just `User` alone, like
        # `UserIP`. Because `Email` and `UserEmail` have some automagic going on that causes them to
        # be created when a `User` is, we explicitly check to ensure that they are behaving
        # correctly as well.
        assert User.objects.count() == 1
        assert UserIP.objects.count() == 1
        assert UserEmail.objects.count() == 1
        assert Email.objects.count() == 1

        assert not User.objects.filter(username="user_1").exists()
        assert User.objects.filter(username="user_2").exists()

    def test_export_filter_users_shared_email(self):
        self.create_exhaustive_user("user_1", email="a@example.com")
        self.create_exhaustive_user("user_2", email="b@example.com")
        self.create_exhaustive_user("user_3", email="a@example.com")
        self.create_exhaustive_user("user_4", email="b@example.com")

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path) as tmp_file:
                import_in_user_scope(
                    tmp_file, user_filter={"user_1", "user_2", "user_3"}, printer=NOOP_PRINTER
                )

        assert User.objects.count() == 3
        assert UserIP.objects.count() == 3
        assert UserEmail.objects.count() == 3
        assert Email.objects.count() == 2  # Lower due to shared emails

        assert User.objects.filter(username="user_1").exists()
        assert User.objects.filter(username="user_2").exists()
        assert User.objects.filter(username="user_3").exists()
        assert not User.objects.filter(username="user_4").exists()

    def test_import_filter_users_empty(self):
        self.create_exhaustive_user("user_1")
        self.create_exhaustive_user("user_2")

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path) as tmp_file:
                import_in_user_scope(tmp_file, user_filter=set(), printer=NOOP_PRINTER)

        assert User.objects.count() == 0
        assert UserIP.objects.count() == 0
        assert UserEmail.objects.count() == 0
        assert Email.objects.count() == 0

    def test_import_filter_orgs_single(self):
        a = self.create_exhaustive_user("user_a_only", email="shared@example.com")
        b = self.create_exhaustive_user("user_b_only", email="shared@example.com")
        c = self.create_exhaustive_user("user_c_only", email="shared@example.com")
        a_b = self.create_exhaustive_user("user_a_and_b")
        b_c = self.create_exhaustive_user("user_b_and_c")
        a_b_c = self.create_exhaustive_user("user_all", email="shared@example.com")
        self.create_exhaustive_organization("org-a", a, a_b, [a_b_c])
        self.create_exhaustive_organization("org-b", b_c, a_b_c, [b, a_b])
        self.create_exhaustive_organization("org-c", a_b_c, b_c, [c])

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path) as tmp_file:
                import_in_organization_scope(tmp_file, org_filter={"org-b"}, printer=NOOP_PRINTER)

        assert Organization.objects.count() == 1
        assert OrgAuthToken.objects.count() == 1

        assert not Organization.objects.filter(slug="org-a").exists()
        assert Organization.objects.filter(slug="org-b").exists()
        assert not Organization.objects.filter(slug="org-c").exists()

        assert User.objects.count() == 4
        assert UserIP.objects.count() == 4
        assert UserEmail.objects.count() == 4
        assert Email.objects.count() == 3  # Lower due to `shared@example.com`

        assert not User.objects.filter(username="user_a_only").exists()
        assert User.objects.filter(username="user_b_only").exists()
        assert not User.objects.filter(username="user_c_only").exists()
        assert User.objects.filter(username="user_a_and_b").exists()
        assert User.objects.filter(username="user_b_and_c").exists()
        assert User.objects.filter(username="user_all").exists()

    def test_import_filter_orgs_multiple(self):
        a = self.create_exhaustive_user("user_a_only", email="shared@example.com")
        b = self.create_exhaustive_user("user_b_only", email="shared@example.com")
        c = self.create_exhaustive_user("user_c_only", email="shared@example.com")
        a_b = self.create_exhaustive_user("user_a_and_b")
        b_c = self.create_exhaustive_user("user_b_and_c")
        a_b_c = self.create_exhaustive_user("user_all", email="shared@example.com")
        self.create_exhaustive_organization("org-a", a, a_b, [a_b_c])
        self.create_exhaustive_organization("org-b", b_c, a_b_c, [b, a_b])
        self.create_exhaustive_organization("org-c", a_b_c, b_c, [c])

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path) as tmp_file:
                import_in_organization_scope(
                    tmp_file, org_filter={"org-a", "org-c"}, printer=NOOP_PRINTER
                )

        assert Organization.objects.count() == 2
        assert OrgAuthToken.objects.count() == 2

        assert Organization.objects.filter(slug="org-a").exists()
        assert not Organization.objects.filter(slug="org-b").exists()
        assert Organization.objects.filter(slug="org-c").exists()

        assert User.objects.count() == 5
        assert UserIP.objects.count() == 5
        assert UserEmail.objects.count() == 5
        assert Email.objects.count() == 3  # Lower due to `shared@example.com`

        assert User.objects.filter(username="user_a_only").exists()
        assert not User.objects.filter(username="user_b_only").exists()
        assert User.objects.filter(username="user_c_only").exists()
        assert User.objects.filter(username="user_a_and_b").exists()
        assert User.objects.filter(username="user_b_and_c").exists()
        assert User.objects.filter(username="user_all").exists()

    def test_import_filter_orgs_empty(self):
        a = self.create_exhaustive_user("user_a_only")
        b = self.create_exhaustive_user("user_b_only")
        c = self.create_exhaustive_user("user_c_only")
        a_b = self.create_exhaustive_user("user_a_and_b")
        b_c = self.create_exhaustive_user("user_b_and_c")
        a_b_c = self.create_exhaustive_user("user_all")
        self.create_exhaustive_organization("org-a", a, a_b, [a_b_c])
        self.create_exhaustive_organization("org-b", b_c, a_b_c, [b, a_b])
        self.create_exhaustive_organization("org-c", a_b_c, b_c, [c])

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path) as tmp_file:
                import_in_organization_scope(tmp_file, org_filter=set(), printer=NOOP_PRINTER)

        assert Organization.objects.count() == 0
        assert OrgAuthToken.objects.count() == 0

        assert User.objects.count() == 0
        assert UserIP.objects.count() == 0
        assert UserEmail.objects.count() == 0
        assert Email.objects.count() == 0
