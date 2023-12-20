from __future__ import annotations

import tempfile
from copy import deepcopy
from pathlib import Path
from typing import Any, Type

from sentry.backup.comparators import get_default_comparators
from sentry.backup.dependencies import NormalizedModelName, get_model, get_model_name
from sentry.backup.scopes import ExportScope
from sentry.backup.validate import validate
from sentry.db import models
from sentry.models.email import Email
from sentry.models.organization import Organization
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.models.user import User
from sentry.models.useremail import UserEmail
from sentry.models.userip import UserIP
from sentry.models.userpermission import UserPermission
from sentry.models.userrole import UserRole, UserRoleUser
from sentry.testutils.helpers.backups import (
    BackupTestCase,
    ValidationError,
    export_to_encrypted_tarball,
    export_to_file,
)
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import region_silo_test
from sentry.utils.json import JSONData
from tests.sentry.backup import get_matching_exportable_models


class ExportTestCase(BackupTestCase):
    def export(
        self,
        tmp_dir,
        *,
        scope: ExportScope,
        filter_by: set[str] | None = None,
    ) -> JSONData:
        tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
        return export_to_file(tmp_path, scope=scope, filter_by=filter_by)

    def export_and_encrypt(
        self,
        tmp_dir,
        *,
        scope: ExportScope,
        filter_by: set[str] | None = None,
    ) -> JSONData:
        tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.enc.tar")
        return export_to_encrypted_tarball(tmp_path, scope=scope, filter_by=filter_by)


@region_silo_test
class ScopingTests(ExportTestCase):
    """
    Ensures that only models with the allowed relocation scopes are actually exported.
    """

    @staticmethod
    def verify_model_inclusion(data: JSONData, scope: ExportScope) -> None:
        """
        Ensure all in-scope models are included, and that no out-of-scope models are included.
        """
        matching_models = get_matching_exportable_models(
            lambda mr: len(mr.get_possible_relocation_scopes() & scope.value) > 0
        )
        unseen_models = deepcopy(matching_models)

        for entry in data:
            model_name = NormalizedModelName(entry["model"])
            model = get_model(model_name)
            if model is not None:
                unseen_models.discard(model)
                if model not in matching_models:
                    raise AssertionError(
                        f"Model `{model_name}` was included in export despite not containing one of these relocation scopes: {scope.value}"
                    )

        if unseen_models:
            raise AssertionError(
                f"The following models were not included in the export: ${unseen_models}; this is despite it being included in at least one of the following relocation scopes: {scope.value}"
            )

    def verify_encryption_equality(
        self, tmp_dir: str, unencrypted: JSONData, scope: ExportScope
    ) -> None:
        res = validate(
            unencrypted,
            self.export_and_encrypt(tmp_dir, scope=scope),
            get_default_comparators(),
        )
        if res.findings:
            raise ValidationError(res)

    @freeze_time("2023-10-11 18:00:00")
    def test_user_export_scoping(self):
        self.create_exhaustive_instance(is_superadmin=True)
        with tempfile.TemporaryDirectory() as tmp_dir:
            unencrypted = self.export(tmp_dir, scope=ExportScope.User)
            self.verify_model_inclusion(unencrypted, ExportScope.User)
            assert unencrypted == self.export_and_encrypt(tmp_dir, scope=ExportScope.User)

    @freeze_time("2023-10-11 18:00:00")
    def test_organization_export_scoping(self):
        self.create_exhaustive_instance(is_superadmin=True)
        with tempfile.TemporaryDirectory() as tmp_dir:
            unencrypted = self.export(tmp_dir, scope=ExportScope.Organization)
            self.verify_model_inclusion(unencrypted, ExportScope.Organization)
            assert unencrypted == self.export_and_encrypt(tmp_dir, scope=ExportScope.Organization)

    @freeze_time("2023-10-11 18:00:00")
    def test_config_export_scoping(self):
        self.create_exhaustive_instance(is_superadmin=True)
        self.create_exhaustive_user("admin", is_admin=True)
        self.create_exhaustive_user("staff", is_staff=True)
        self.create_exhaustive_user("superuser", is_superuser=True)
        with tempfile.TemporaryDirectory() as tmp_dir:
            unencrypted = self.export(tmp_dir, scope=ExportScope.Config)
            self.verify_model_inclusion(unencrypted, ExportScope.Config)
            assert unencrypted == self.export_and_encrypt(tmp_dir, scope=ExportScope.Config)

    @freeze_time("2023-10-11 18:00:00")
    def test_global_export_scoping(self):
        self.create_exhaustive_instance(is_superadmin=True)
        with tempfile.TemporaryDirectory() as tmp_dir:
            unencrypted = self.export(tmp_dir, scope=ExportScope.Global)
            self.verify_model_inclusion(unencrypted, ExportScope.Global)
            assert unencrypted == self.export_and_encrypt(tmp_dir, scope=ExportScope.Global)


# Filters should work identically in both silo and monolith modes, so no need to repeat the tests
# here.
@region_silo_test
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
            data = self.export(tmp_dir, scope=ExportScope.User, filter_by=set())

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
                filter_by=set(),
            )

            assert len(data) == 0

    def test_export_keep_only_admin_users_in_config_scope(self):
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
            assert not self.exists(data, User, "username", "regular")
            assert self.exists(data, User, "username", "admin")
            assert self.exists(data, User, "username", "staff")
            assert self.exists(data, User, "username", "superuser")
            assert self.count(data, UserRole) == 1
            assert self.count(data, UserRoleUser) == 1
            assert self.count(data, UserPermission) == 1
