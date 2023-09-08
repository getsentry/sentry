from __future__ import annotations

import tempfile
from copy import deepcopy
from datetime import datetime
from functools import cached_property
from pathlib import Path
from unittest.mock import patch

import pytest
from rest_framework.serializers import ValidationError

from sentry.backup.helpers import get_exportable_sentry_models
from sentry.backup.imports import (
    import_in_global_scope,
    import_in_organization_scope,
    import_in_user_scope,
)
from sentry.backup.scopes import ExportScope, RelocationScope
from sentry.models.authenticator import Authenticator
from sentry.models.email import Email
from sentry.models.options.project_option import ProjectOption
from sentry.models.organization import Organization
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.models.project import Project
from sentry.models.projectkey import ProjectKey
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


class ImportTestCase(BackupTestCase):
    def export_to_tmp_file_and_clear_database(self, tmp_dir) -> Path:
        tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
        export_to_file(tmp_path, ExportScope.Global)
        clear_database()
        return tmp_path


@run_backup_tests_only_on_single_db
class SanitizationTests(ImportTestCase):
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

    def generate_tmp_json_file(self, tmp_path: Path) -> json.JSONData:
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

        # Every user except `max_user` shares an email.
        assert Email.objects.count() == 2

        # All `UserEmail`s must have their verification status reset in this scope.
        assert UserEmail.objects.count() == 4
        assert UserEmail.objects.filter(is_verified=True).count() == 0
        assert UserEmail.objects.filter(date_hash_added__lt=datetime(2023, 7, 1, 0, 0)).count() == 0
        assert (
            UserEmail.objects.filter(validation_hash="mCnWesSVvYQcq7qXQ36AZHwosAd6cghE").count()
            == 0
        )

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

        # Every user except `max_user` shares an email.
        assert Email.objects.count() == 2

        # All `UserEmail`s must have their verification status reset in this scope.
        assert UserEmail.objects.count() == 4
        assert UserEmail.objects.filter(is_verified=True).count() == 0
        assert UserEmail.objects.filter(date_hash_added__lt=datetime(2023, 7, 1, 0, 0)).count() == 0
        assert (
            UserEmail.objects.filter(validation_hash="mCnWesSVvYQcq7qXQ36AZHwosAd6cghE").count()
            == 0
        )

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
        assert UserEmail.objects.count() == 4

        # Every user except `max_user` shares an email.
        assert Email.objects.count() == 2

        # All `UserEmail`s must keep their imported verification status reset in this scope.
        assert UserEmail.objects.count() == 4
        assert UserEmail.objects.filter(is_verified=True).count() == 4
        assert UserEmail.objects.filter(date_hash_added__lt=datetime(2023, 7, 1, 0, 0)).count() == 4
        assert (
            UserEmail.objects.filter(validation_hash="mCnWesSVvYQcq7qXQ36AZHwosAd6cghE").count()
            == 4
        )

        # 1 from `max_user`, 1 from `permission_user`.
        assert UserPermission.objects.count() == 2

        # 1 from `max_user`.
        assert UserRole.objects.count() == 1
        assert UserRoleUser.objects.count() == 1

    def test_generate_suffix_for_already_taken_organization(self):
        owner = self.create_user(email="testing@example.com")
        self.create_organization(name="some-org", owner=owner)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)

            # Note that we have created an organization with the same name as one we are about to
            # import.
            self.create_organization(owner=self.user, name="some-org")
            with open(tmp_path) as tmp_file:
                import_in_organization_scope(tmp_file, printer=NOOP_PRINTER)

        assert Organization.objects.count() == 2
        assert Organization.objects.filter(slug__icontains="some-org").count() == 2
        assert Organization.objects.filter(slug__iexact="some-org").count() == 1
        assert Organization.objects.filter(slug__icontains="some-org-").count() == 1

        assert OrganizationMapping.objects.count() == 2
        assert OrganizationMapping.objects.filter(slug__icontains="some-org").count() == 2
        assert OrganizationMapping.objects.filter(slug__iexact="some-org").count() == 1
        assert OrganizationMapping.objects.filter(slug__icontains="some-org-").count() == 1

    def test_generate_suffix_for_already_taken_username(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            self.create_user("testing@example.com")
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            with open(tmp_path, "w+") as tmp_file:
                same_username_user = self.json_of_exhaustive_user_with_minimum_privileges
                copy_of_same_username_user = self.copy_user(
                    same_username_user, "testing@example.com"
                )
                json.dump(same_username_user + copy_of_same_username_user, tmp_file)

            with open(tmp_path) as tmp_file:
                import_in_user_scope(tmp_file, printer=NOOP_PRINTER)

            assert User.objects.count() == 3
            assert User.objects.filter(username__icontains="testing@example.com").count() == 3
            assert User.objects.filter(username__iexact="testing@example.com").count() == 1
            assert User.objects.filter(username__icontains="testing@example.com-").count() == 2

    def test_bad_invalid_user(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            with open(tmp_path, "w+") as tmp_file:
                models = self.json_of_exhaustive_user_with_minimum_privileges

                # Modify all username to be longer than 128 characters.
                for model in models:
                    if model["model"] == "sentry.user":
                        model["fields"]["username"] = "x" * 129
                json.dump(models, tmp_file)

            with open(tmp_path) as tmp_file:
                with pytest.raises(ValidationError):
                    import_in_user_scope(tmp_file, printer=NOOP_PRINTER)

    @patch("sentry.models.userip.geo_by_addr")
    def test_good_regional_user_ip_in_user_scope(self, mock_geo_by_addr):
        mock_geo_by_addr.return_value = {
            "country_code": "US",
            "region": "CA",
            "subdivision": "San Francisco",
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            with open(tmp_path, "w+") as tmp_file:
                models = self.json_of_exhaustive_user_with_minimum_privileges

                # Modify the UserIP to be in California, USA.
                for model in models:
                    if model["model"] == "sentry.userip":
                        model["fields"]["ip_address"] = "8.8.8.8"
                json.dump(models, tmp_file)

            with open(tmp_path) as tmp_file:
                import_in_user_scope(tmp_file, printer=NOOP_PRINTER)

        assert UserIP.objects.count() == 1
        assert UserIP.objects.filter(ip_address="8.8.8.8").exists()
        assert UserIP.objects.filter(country_code="US").exists()
        assert UserIP.objects.filter(region_code="CA").exists()
        assert UserIP.objects.filter(last_seen__gt=datetime(2023, 7, 1, 0, 0)).exists()

        # Unlike global scope, this time must be reset.
        assert UserIP.objects.filter(first_seen__gt=datetime(2023, 7, 1, 0, 0)).exists()

    @patch("sentry.models.userip.geo_by_addr")
    def test_good_regional_user_ip_in_global_scope(self, mock_geo_by_addr):
        mock_geo_by_addr.return_value = {
            "country_code": "US",
            "region": "CA",
            "subdivision": "San Francisco",
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            with open(tmp_path, "w+") as tmp_file:
                models = self.json_of_exhaustive_user_with_minimum_privileges

                # Modify the UserIP to be in California, USA.
                for model in models:
                    if model["model"] == "sentry.userip":
                        model["fields"]["ip_address"] = "8.8.8.8"
                json.dump(models, tmp_file)

            with open(tmp_path) as tmp_file:
                import_in_global_scope(tmp_file, printer=NOOP_PRINTER)

        assert UserIP.objects.count() == 1
        assert UserIP.objects.filter(ip_address="8.8.8.8").exists()
        assert UserIP.objects.filter(country_code="US").exists()
        assert UserIP.objects.filter(region_code="CA").exists()
        assert UserIP.objects.filter(last_seen__gt=datetime(2023, 7, 1, 0, 0)).exists()

        # Unlike org/user scope, this must NOT be reset.
        assert not UserIP.objects.filter(first_seen__gt=datetime(2023, 7, 1, 0, 0)).exists()

    def test_bad_invalid_user_ip(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            with open(tmp_path, "w+") as tmp_file:
                models = self.json_of_exhaustive_user_with_minimum_privileges

                # Modify the IP address to be in invalid.
                for m in models:
                    if m["model"] == "sentry.userip":
                        m["fields"]["ip_address"] = "0.1.2.3.4.5.6.7.8.9.abc.def"
                json.dump(list(models), tmp_file)

            with open(tmp_path) as tmp_file:
                with pytest.raises(ValidationError):
                    import_in_user_scope(tmp_file, printer=NOOP_PRINTER)

    def test_bad_invalid_user_option(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            with open(tmp_path, "w+") as tmp_file:
                models = self.json_of_exhaustive_user_with_minimum_privileges

                # Modify the `timezone` option to be in invalid.
                for m in models:
                    if m["model"] == "sentry.useroption" and m["fields"]["key"] == "timezone":
                        m["fields"]["value"] = '"MiddleEarth/Gondor"'
                json.dump(list(models), tmp_file)

            with open(tmp_path) as tmp_file:
                with pytest.raises(ValidationError):
                    import_in_user_scope(tmp_file, printer=NOOP_PRINTER)


@run_backup_tests_only_on_single_db
class SignalingTests(ImportTestCase):
    """
    Some models are automatically created via signals and similar automagic from related models. We
    test that behavior here. Specifically, we test the following:
        - That `Email` and `UserEmail` are automatically created when `User` is.
        - That `OrganizationMapping` and `OrganizationMemberMapping` are automatically created when
          `Organization is.
        - That `ProjectKey` and `ProjectOption` instances are automatically created when `Project`
          is.
    """

    def test_import_signaling_user(self):
        self.create_exhaustive_user("user", email="me@example.com")

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path) as tmp_file:
                import_in_user_scope(tmp_file, printer=NOOP_PRINTER)

        assert User.objects.count() == 1
        assert User.objects.filter(email="me@example.com").exists()

        assert UserEmail.objects.count() == 1
        assert UserEmail.objects.filter(email="me@example.com").exists()

        assert Email.objects.count() == 1
        assert Email.objects.filter(email="me@example.com").exists()

    def test_import_signaling_organization(self):
        owner = self.create_exhaustive_user("owner")
        invited = self.create_exhaustive_user("invited")
        member = self.create_exhaustive_user("member")
        self.create_exhaustive_organization("some-org", owner, invited, [member])

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path) as tmp_file:
                import_in_organization_scope(tmp_file, printer=NOOP_PRINTER)

        assert Organization.objects.count() == 1
        assert Organization.objects.filter(slug="some-org").exists()

        assert OrganizationMapping.objects.count() == 1
        assert OrganizationMapping.objects.filter(slug="some-org").exists()

        assert OrganizationMember.objects.count() == 3
        assert OrganizationMemberMapping.objects.count() == 3

        # The exhaustive org has 2 projects which automatically get 1 key and 3 options each.
        assert Project.objects.count() == 2
        assert Project.objects.filter(name="project-some-org").exists()
        assert Project.objects.filter(name="other-project-some-org").exists()

        assert ProjectKey.objects.count() == 2
        assert ProjectOption.objects.count() == 6
        assert ProjectOption.objects.filter(key="sentry:relay-rev").exists()
        assert ProjectOption.objects.filter(key="sentry:relay-rev-lastchange").exists()
        assert ProjectOption.objects.filter(key="sentry:option-epoch").exists()

    def test_import_colliding_project_key(self):
        owner = self.create_exhaustive_user("owner")
        invited = self.create_exhaustive_user("invited")
        member = self.create_exhaustive_user("member")
        self.create_exhaustive_organization("some-org", owner, invited, [member])

        # Take note of the `ProjectKey` that was created by the exhaustive organization - this is
        # the one we'll be importing.
        colliding = ProjectKey.objects.filter().first()
        colliding_public_key = colliding.public_key
        colliding_secret_key = colliding.secret_key

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)

            # After exporting and clearing the database, insert a copy of the same `ProjectKey` as
            # the one found in the import.
            project = self.create_project()
            ProjectKey.objects.create(
                project=project,
                label="Test",
                public_key=colliding_public_key,
                secret_key=colliding_secret_key,
            )

            with open(tmp_path) as tmp_file:
                import_in_organization_scope(tmp_file, printer=NOOP_PRINTER)

        assert ProjectKey.objects.count() == 4
        assert ProjectKey.objects.filter(public_key=colliding_public_key).count() == 1
        assert ProjectKey.objects.filter(secret_key=colliding_secret_key).count() == 1


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
