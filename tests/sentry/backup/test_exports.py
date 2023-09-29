from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any, Type

from sentry.backup.dependencies import get_model_name
from sentry.backup.helpers import get_exportable_sentry_models
from sentry.backup.scopes import ExportScope
from sentry.db import models
from sentry.models.email import Email
from sentry.models.organization import Organization
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.models.user import User
from sentry.models.useremail import UserEmail
from sentry.models.userip import UserIP
from sentry.models.userpermission import UserPermission
from sentry.models.userrole import UserRole, UserRoleUser
from sentry.testutils.helpers.backups import BackupTestCase, export_to_file
from sentry.utils.json import JSONData


class ExportTestCase(BackupTestCase):
    def export(self, tmp_dir, **kwargs) -> JSONData:
        tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
        return export_to_file(tmp_path, **kwargs)


class ScopingTests(ExportTestCase):
    """
    Ensures that only models with the allowed relocation scopes are actually exported.
    """

    @staticmethod
    def get_models_for_scope(scope: ExportScope) -> set[str]:
        matching_models = set()
        for model in get_exportable_sentry_models():
            if model.get_possible_relocation_scopes() & scope.value:
                obj_name = model._meta.object_name
                if obj_name is not None:
                    matching_models.add("sentry." + obj_name.lower())
        return matching_models

    def test_user_export_scoping(self):
        matching_models = self.get_models_for_scope(ExportScope.User)
        self.create_exhaustive_instance(is_superadmin=True)
        with tempfile.TemporaryDirectory() as tmp_dir:
            data = self.export(tmp_dir, scope=ExportScope.User)
            for entry in data:
                model_name = entry["model"]
                if model_name not in matching_models:
                    raise AssertionError(
                        f"Model `${model_name}` was included in export despite not being `RelocationScope.User`"
                    )

    def test_organization_export_scoping(self):
        matching_models = self.get_models_for_scope(ExportScope.Organization)
        self.create_exhaustive_instance(is_superadmin=True)
        with tempfile.TemporaryDirectory() as tmp_dir:
            data = self.export(tmp_dir, scope=ExportScope.Organization)
            for entry in data:
                model_name = entry["model"]
                if model_name not in matching_models:
                    raise AssertionError(
                        f"Model `${model_name}` was included in export despite not being `RelocationScope.User` or `RelocationScope.Organization`"
                    )

    def test_config_export_scoping(self):
        matching_models = self.get_models_for_scope(ExportScope.Config)
        self.create_exhaustive_instance(is_superadmin=True)
        self.create_exhaustive_user("admin", is_admin=True)
        self.create_exhaustive_user("staff", is_staff=True)
        self.create_exhaustive_user("superuser", is_superuser=True)
        with tempfile.TemporaryDirectory() as tmp_dir:
            data = self.export(tmp_dir, scope=ExportScope.Config)
            for entry in data:
                model_name = entry["model"]
                if model_name not in matching_models:
                    raise AssertionError(
                        f"Model `${model_name}` was included in export despite not being `RelocationScope.User` or `RelocationScope.Config`"
                    )

    def test_global_export_scoping(self):
        matching_models = self.get_models_for_scope(ExportScope.Global)
        self.create_exhaustive_instance(is_superadmin=True)
        with tempfile.TemporaryDirectory() as tmp_dir:
            data = self.export(tmp_dir, scope=ExportScope.Global)
            for entry in data:
                model_name = entry["model"]
                if model_name not in matching_models:
                    raise AssertionError(
                        f"Model `${model_name}` was included in export despite being labeled `RelocationScope.Excluded"
                    )


class FilteringTests(ExportTestCase):
    """
    Ensures that filtering operations include the correct models.
    """

    @staticmethod
    def count(data: JSONData, model: Type[models.base.BaseModel]) -> int:
        return len(list(filter(lambda d: d["model"] == str(get_model_name(model)), data)))

    @staticmethod
    def exists(
        data: JSONData, model: Type[models.base.BaseModel], key: str, value: Any | None = None
    ) -> bool:
        for d in data:
            if d["model"] == str(get_model_name(model)):
                field = d["fields"].get(key)
                if field is None:
                    continue
                if value is None:
                    return True
                if field == value:
                    return True
        return False

    def test_export_filter_users(self):
        self.create_exhaustive_user("user_1")
        self.create_exhaustive_user("user_2")

        with tempfile.TemporaryDirectory() as tmp_dir:
            data = self.export(tmp_dir, scope=ExportScope.User, filter_by={"user_2"})

            # Count users, but also count a random model naively derived from just `User` alone,
            # like `UserIP`. Because `Email` and `UserEmail` have some automagic going on that
            # causes them to be created when a `User` is, we explicitly check to ensure that they
            # are behaving correctly as well.
            assert self.count(data, User) == 1
            assert self.count(data, UserIP) == 1
            assert self.count(data, UserEmail) == 1
            assert self.count(data, Email) == 1

            assert not self.exists(data, User, "username", "user_1")
            assert self.exists(data, User, "username", "user_2")

    def test_export_filter_users_shared_email(self):
        self.create_exhaustive_user("user_1", email="a@example.com")
        self.create_exhaustive_user("user_2", email="b@example.com")
        self.create_exhaustive_user("user_3", email="a@example.com")
        self.create_exhaustive_user("user_4", email="b@example.com")

        with tempfile.TemporaryDirectory() as tmp_dir:
            data = self.export(
                tmp_dir,
                scope=ExportScope.User,
                filter_by={"user_1", "user_2", "user_3"},
            )

            assert self.count(data, User) == 3
            assert self.count(data, UserIP) == 3
            assert self.count(data, UserEmail) == 3
            assert self.count(data, Email) == 2

            assert self.exists(data, User, "username", "user_1")
            assert self.exists(data, User, "username", "user_2")
            assert self.exists(data, User, "username", "user_3")
            assert not self.exists(data, User, "username", "user_4")

    def test_export_filter_users_empty(self):
        self.create_exhaustive_user("user_1")
        self.create_exhaustive_user("user_2")

        with tempfile.TemporaryDirectory() as tmp_dir:
            data = self.export(tmp_dir, scope=ExportScope.User, filter_by={})

            assert len(data) == 0

    def test_export_filter_orgs_single(self):
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
            data = self.export(
                tmp_dir,
                scope=ExportScope.Organization,
                filter_by={"org-b"},
            )

            assert self.count(data, Organization) == 1
            assert self.count(data, OrgAuthToken) == 1

            assert not self.exists(data, Organization, "slug", "org-a")
            assert self.exists(data, Organization, "slug", "org-b")
            assert not self.exists(data, Organization, "slug", "org-c")

            assert self.count(data, User) == 4
            assert self.count(data, UserIP) == 4
            assert self.count(data, UserEmail) == 4
            assert self.count(data, Email) == 3  # Lower due to `shared@example.com`

            assert not self.exists(data, User, "username", "user_a_only")
            assert self.exists(data, User, "username", "user_b_only")
            assert not self.exists(data, User, "username", "user_c_only")
            assert self.exists(data, User, "username", "user_a_and_b")
            assert self.exists(data, User, "username", "user_b_and_c")
            assert self.exists(data, User, "username", "user_all")

    def test_export_filter_orgs_multiple(self):
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
            data = self.export(
                tmp_dir,
                scope=ExportScope.Organization,
                filter_by={"org-a", "org-c"},
            )

            assert self.count(data, Organization) == 2
            assert self.count(data, OrgAuthToken) == 2

            assert self.exists(data, Organization, "slug", "org-a")
            assert not self.exists(data, Organization, "slug", "org-b")
            assert self.exists(data, Organization, "slug", "org-c")

            assert self.count(data, User) == 5
            assert self.count(data, UserIP) == 5
            assert self.count(data, UserEmail) == 5
            assert self.count(data, Email) == 3  # Lower due to `shared@example.com`

            assert self.exists(data, User, "username", "user_a_only")
            assert not self.exists(data, User, "username", "user_b_only")
            assert self.exists(data, User, "username", "user_c_only")
            assert self.exists(data, User, "username", "user_a_and_b")
            assert self.exists(data, User, "username", "user_b_and_c")
            assert self.exists(data, User, "username", "user_all")

    def test_export_filter_orgs_empty(self):
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
            data = self.export(
                tmp_dir,
                scope=ExportScope.Organization,
                filter_by={},
            )

            assert self.count(data, Organization) == 0
            assert self.count(data, OrgAuthToken) == 0

            assert self.count(data, User) == 0
            assert self.count(data, UserIP) == 0
            assert self.count(data, UserEmail) == 0
            assert self.count(data, Email) == 0

    def test_export_only_keep_admin_users_in_config_scope(self):
        self.create_exhaustive_user("regular")
        self.create_exhaustive_user("admin", is_admin=True)
        self.create_exhaustive_user("staff", is_staff=True)
        self.create_exhaustive_user("superuser", is_staff=True)

        with tempfile.TemporaryDirectory() as tmp_dir:
            data = self.export(
                tmp_dir,
                scope=ExportScope.Config,
            )

            assert self.count(data, User) == 3
            assert self.count(data, UserRole) == 1
            assert self.count(data, UserRoleUser) == 1
            assert self.count(data, UserPermission) == 1
