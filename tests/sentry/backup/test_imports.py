from __future__ import annotations

import tempfile
from copy import deepcopy
from datetime import datetime
from functools import cached_property
from pathlib import Path
from unittest.mock import patch

import pytest
from django.utils import timezone
from rest_framework.serializers import ValidationError

from sentry.backup.helpers import ImportFlags
from sentry.backup.imports import (
    import_in_config_scope,
    import_in_global_scope,
    import_in_organization_scope,
    import_in_user_scope,
)
from sentry.backup.scopes import ExportScope, ImportScope, RelocationScope
from sentry.models.apitoken import DEFAULT_EXPIRATION, ApiToken, generate_token
from sentry.models.authenticator import Authenticator
from sentry.models.email import Email
from sentry.models.options.option import ControlOption, Option
from sentry.models.options.project_option import ProjectOption
from sentry.models.organization import Organization
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.models.project import Project
from sentry.models.projectkey import ProjectKey
from sentry.models.relay import Relay, RelayUsage
from sentry.models.user import User
from sentry.models.useremail import UserEmail
from sentry.models.userip import UserIP
from sentry.models.userpermission import UserPermission
from sentry.models.userrole import UserRole, UserRoleUser
from sentry.monitors.models import Monitor
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.helpers.backups import (
    NOOP_PRINTER,
    BackupTestCase,
    clear_database,
    export_to_file,
)
from sentry.utils import json
from tests.sentry.backup import get_matching_exportable_models


class ImportTestCase(BackupTestCase):
    def export_to_tmp_file_and_clear_database(self, tmp_dir) -> Path:
        tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
        export_to_file(tmp_path, ExportScope.Global)
        clear_database()
        return tmp_path


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
                model["fields"]["is_managed"] = True
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
        assert (
            User.objects.filter(is_managed=False, is_staff=False, is_superuser=False).count() == 4
        )

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

        assert User.objects.filter(is_unclaimed=True).count() == 4
        assert User.objects.filter(is_managed=True).count() == 0
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
        assert (
            User.objects.filter(is_managed=False, is_staff=False, is_superuser=False).count() == 4
        )

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

        assert User.objects.filter(is_unclaimed=True).count() == 4
        assert User.objects.filter(is_managed=True).count() == 0
        assert User.objects.filter(is_staff=True).count() == 0
        assert User.objects.filter(is_superuser=True).count() == 0
        assert Authenticator.objects.count() == 0
        assert UserPermission.objects.count() == 0
        assert UserRole.objects.count() == 0
        assert UserRoleUser.objects.count() == 0

    def test_users_unsanitized_in_config_scope(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            self.generate_tmp_json_file(tmp_path)
            with open(tmp_path) as tmp_file:
                import_in_config_scope(tmp_file, printer=NOOP_PRINTER)

        assert User.objects.count() == 4
        assert User.objects.filter(is_unclaimed=True).count() == 4
        assert User.objects.filter(is_managed=True).count() == 1
        assert User.objects.filter(is_staff=True).count() == 2
        assert User.objects.filter(is_superuser=True).count() == 2
        assert (
            User.objects.filter(is_managed=False, is_staff=False, is_superuser=False).count() == 2
        )
        assert UserEmail.objects.count() == 4

        # Unlike the "global" scope, we do not keep authentication information for the "config"
        # scope.
        assert Authenticator.objects.count() == 0

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

        # 1 from `max_user`, 1 from `permission_user`.
        assert UserPermission.objects.count() == 2

        # 1 from `max_user`.
        assert UserRole.objects.count() == 1
        assert UserRoleUser.objects.count() == 1

    def test_users_unsanitized_in_global_scope(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            self.generate_tmp_json_file(tmp_path)
            with open(tmp_path) as tmp_file:
                import_in_global_scope(tmp_file, printer=NOOP_PRINTER)

        assert User.objects.count() == 4
        assert User.objects.filter(is_unclaimed=True).count() == 4
        assert User.objects.filter(is_managed=True).count() == 1
        assert User.objects.filter(is_staff=True).count() == 2
        assert User.objects.filter(is_superuser=True).count() == 2
        assert (
            User.objects.filter(is_managed=False, is_staff=False, is_superuser=False).count() == 2
        )
        assert UserEmail.objects.count() == 4

        # Unlike the "config" scope, we keep authentication information for the "global" scope.
        assert Authenticator.objects.count() == 4

        # Every user except `max_user` shares an email.
        assert Email.objects.count() == 2

        # All `UserEmail`s must have their imported verification status reset in this scope.
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


class ScopingTests(ImportTestCase):
    """
    Ensures that only models with the allowed relocation scopes are actually imported.
    """

    @staticmethod
    def verify_model_inclusion(scope: ImportScope):
        """
        Ensure all in-scope models are included, and that no out-of-scope models are included.
        """
        included_models = get_matching_exportable_models(
            lambda mr: len(mr.get_possible_relocation_scopes() & scope.value) > 0
        )
        excluded_models = get_matching_exportable_models(
            lambda mr: mr.get_possible_relocation_scopes() != {RelocationScope.Excluded}
            and not (mr.get_possible_relocation_scopes() & scope.value)
        )

        for model in included_models:
            assert model.objects.count() > 0
        for model in excluded_models:
            assert model.objects.count() == 0

    def test_user_import_scoping(self):
        self.create_exhaustive_instance(is_superadmin=True)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path) as tmp_file:
                import_in_user_scope(tmp_file, printer=NOOP_PRINTER)
                self.verify_model_inclusion(ImportScope.User)

    def test_organization_import_scoping(self):
        self.create_exhaustive_instance(is_superadmin=True)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path) as tmp_file:
                import_in_organization_scope(tmp_file, printer=NOOP_PRINTER)
                self.verify_model_inclusion(ImportScope.Organization)

    def test_config_import_scoping(self):
        self.create_exhaustive_instance(is_superadmin=True)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path) as tmp_file:
                import_in_config_scope(tmp_file, printer=NOOP_PRINTER)
                self.verify_model_inclusion(ImportScope.Config)

    def test_global_import_scoping(self):
        self.create_exhaustive_instance(is_superadmin=True)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path) as tmp_file:
                import_in_global_scope(tmp_file, printer=NOOP_PRINTER)
                self.verify_model_inclusion(ImportScope.Global)


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


class CollisionTests(ImportTestCase):
    """
    Ensure that collisions are properly handled in different flag modes.
    """

    def test_colliding_api_token(self):
        owner = self.create_exhaustive_user("owner")
        expires_at = timezone.now() + DEFAULT_EXPIRATION

        # Take note of the `ApiTokens` that were created by the exhaustive organization - this is
        # the one we'll be importing.
        colliding_no_refresh_set = ApiToken.objects.create(
            user=owner, token=generate_token(), expires_at=expires_at
        )
        colliding_same_refresh_only = ApiToken.objects.create(
            user=owner,
            token=generate_token(),
            refresh_token=generate_token(),
            expires_at=expires_at,
        )
        colliding_same_token_only = ApiToken.objects.create(
            user=owner,
            token=generate_token(),
            refresh_token=generate_token(),
            expires_at=expires_at,
        )
        colliding_same_both = ApiToken.objects.create(
            user=owner,
            token=generate_token(),
            refresh_token=generate_token(),
            expires_at=expires_at,
        )

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            owner = self.create_exhaustive_user(username="owner")

            # Re-insert colliding tokens, pointed at the new user.
            colliding_no_refresh_set.user_id = owner.id
            colliding_no_refresh_set.save()

            colliding_same_refresh_only.token = generate_token()
            colliding_same_refresh_only.user_id = owner.id
            colliding_same_refresh_only.save()

            colliding_same_token_only.refresh_token = generate_token()
            colliding_same_token_only.user_id = owner.id
            colliding_same_token_only.save()

            colliding_same_both.user_id = owner.id
            colliding_same_both.save()

            assert ApiToken.objects.count() == 4
            assert ApiToken.objects.filter(token=colliding_no_refresh_set.token).count() == 1
            assert (
                ApiToken.objects.filter(
                    refresh_token=colliding_same_refresh_only.refresh_token
                ).count()
                == 1
            )
            assert ApiToken.objects.filter(token=colliding_same_token_only.token).count() == 1
            assert (
                ApiToken.objects.filter(
                    token=colliding_same_both.token, refresh_token=colliding_same_both.refresh_token
                ).count()
                == 1
            )

            with open(tmp_path) as tmp_file:
                import_in_global_scope(tmp_file, printer=NOOP_PRINTER)

        # Ensure that old tokens have not been mutated.
        assert ApiToken.objects.count() == 8
        assert ApiToken.objects.filter(token=colliding_no_refresh_set.token).count() == 1
        assert (
            ApiToken.objects.filter(refresh_token=colliding_same_refresh_only.refresh_token).count()
            == 1
        )
        assert ApiToken.objects.filter(token=colliding_same_token_only.token).count() == 1
        assert (
            ApiToken.objects.filter(
                token=colliding_same_both.token, refresh_token=colliding_same_both.refresh_token
            ).count()
            == 1
        )

    def test_colliding_monitor(self):
        owner = self.create_exhaustive_user("owner")
        invited = self.create_exhaustive_user("invited")
        self.create_exhaustive_organization("some-org", owner, invited)

        # Take note of a `Monitor` that was created by the exhaustive organization - this is the
        # one we'll be importing.
        colliding = Monitor.objects.filter().first()

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)

            # After exporting and clearing the database, insert a copy of the same `Monitor` as
            # the one found in the import.
            colliding.organization_id = self.create_organization().id
            colliding.project_id = self.create_project().id
            colliding.save()

            assert Monitor.objects.count() == 1
            assert Monitor.objects.filter(guid=colliding.guid).count() == 1

            with open(tmp_path) as tmp_file:
                import_in_organization_scope(tmp_file, printer=NOOP_PRINTER)

        assert Monitor.objects.count() == 2
        assert Monitor.objects.filter(guid=colliding.guid).count() == 1

    def test_colliding_org_auth_token(self):
        owner = self.create_exhaustive_user("owner")
        invited = self.create_exhaustive_user("invited")
        member = self.create_exhaustive_user("member")
        self.create_exhaustive_organization("some-org", owner, invited, [member])

        # Take note of the `OrgAuthToken` that was created by the exhaustive organization - this is
        # the one we'll be importing.
        colliding = OrgAuthToken.objects.filter().first()

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)

            # After exporting and clearing the database, insert a copy of the same `OrgAuthToken` as
            # the one found in the import.
            org = self.create_organization()
            colliding.organization_id = org.id
            colliding.project_last_used_id = self.create_project(organization=org).id
            colliding.save()

            assert OrgAuthToken.objects.count() == 1
            assert OrgAuthToken.objects.filter(token_hashed=colliding.token_hashed).count() == 1
            assert (
                OrgAuthToken.objects.filter(
                    token_last_characters=colliding.token_last_characters
                ).count()
                == 1
            )

            with open(tmp_path) as tmp_file:
                import_in_organization_scope(tmp_file, printer=NOOP_PRINTER)

        assert OrgAuthToken.objects.count() == 2
        assert OrgAuthToken.objects.filter(token_hashed=colliding.token_hashed).count() == 1
        assert (
            OrgAuthToken.objects.filter(
                token_last_characters=colliding.token_last_characters
            ).count()
            == 1
        )

    def test_colliding_project_key(self):
        owner = self.create_exhaustive_user("owner")
        invited = self.create_exhaustive_user("invited")
        member = self.create_exhaustive_user("member")
        self.create_exhaustive_organization("some-org", owner, invited, [member])

        # Take note of a `ProjectKey` that was created by the exhaustive organization - this is the
        # one we'll be importing.
        colliding = ProjectKey.objects.filter().first()

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)

            # After exporting and clearing the database, insert a copy of the same `ProjectKey` as
            # the one found in the import.
            colliding.project = self.create_project()
            colliding.save()

            assert ProjectKey.objects.count() < 4
            assert ProjectKey.objects.filter(public_key=colliding.public_key).count() == 1
            assert ProjectKey.objects.filter(secret_key=colliding.secret_key).count() == 1

            with open(tmp_path) as tmp_file:
                import_in_organization_scope(tmp_file, printer=NOOP_PRINTER)

        assert ProjectKey.objects.count() == 4
        assert ProjectKey.objects.filter(public_key=colliding.public_key).count() == 1
        assert ProjectKey.objects.filter(secret_key=colliding.secret_key).count() == 1

    def test_colliding_query_subscription(self):
        # We need a celery task running to properly test the `subscription_id` assignment, otherwise
        # its value just defaults to `None`.
        with self.tasks():
            owner = self.create_exhaustive_user("owner")
            invited = self.create_exhaustive_user("invited")
            member = self.create_exhaustive_user("member")
            self.create_exhaustive_organization("some-org", owner, invited, [member])

            # Take note of the `QuerySubscription` that was created by the exhaustive organization -
            # this is the one we'll be importing.
            colliding_snuba_query = SnubaQuery.objects.all().first()
            colliding_query_subscription = QuerySubscription.objects.filter(
                snuba_query=colliding_snuba_query
            ).first()

            with tempfile.TemporaryDirectory() as tmp_dir:
                tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)

                # After exporting and clearing the database, insert a copy of the same
                # `QuerySubscription.subscription_id` as the one found in the import.
                colliding_snuba_query.save()
                colliding_query_subscription.project = self.create_project()
                colliding_query_subscription.snuba_query = colliding_snuba_query
                colliding_query_subscription.save()

                assert SnubaQuery.objects.count() == 1
                assert QuerySubscription.objects.count() == 1
                assert (
                    QuerySubscription.objects.filter(
                        subscription_id=colliding_query_subscription.subscription_id
                    ).count()
                    == 1
                )

                with open(tmp_path) as tmp_file:
                    import_in_organization_scope(tmp_file, printer=NOOP_PRINTER)

            assert SnubaQuery.objects.count() > 1
            assert QuerySubscription.objects.count() > 1
            assert (
                QuerySubscription.objects.filter(
                    subscription_id=colliding_query_subscription.subscription_id
                ).count()
                == 1
            )

    def test_colliding_configs_overwrite_configs_enabled_in_config_scope(self):
        owner = self.create_exhaustive_user("owner", is_admin=True)
        self.create_exhaustive_global_configs(owner)

        # Take note of the configs we want to track - this is the one we'll be importing.
        colliding_option = Option.objects.all().first()
        colliding_control_option = ControlOption.objects.all().first()
        colliding_relay = Relay.objects.all().first()
        colliding_relay_usage = RelayUsage.objects.all().first()
        colliding_user_role = UserRole.objects.all().first()

        old_relay_public_key = colliding_relay.public_key
        old_relay_usage_public_key = colliding_relay_usage.public_key
        old_user_role_permissions = colliding_user_role.permissions

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)

            colliding_option.value = "y"
            colliding_option.save()

            colliding_control_option.value = "z"
            colliding_control_option.save()

            colliding_relay.public_key = "invalid"
            colliding_relay.save()

            colliding_relay_usage.public_key = "invalid"
            colliding_relay_usage.save()

            colliding_user_role.permissions = ["other.admin"]
            colliding_user_role.save()

            assert Option.objects.count() == 1
            assert ControlOption.objects.count() == 1
            assert Relay.objects.count() == 1
            assert RelayUsage.objects.count() == 1
            assert UserRole.objects.count() == 1

            with open(tmp_path) as tmp_file:
                import_in_config_scope(
                    tmp_file, flags=ImportFlags(overwrite_configs=True), printer=NOOP_PRINTER
                )

        assert Option.objects.count() == 1
        assert Option.objects.filter(value__exact="a").exists()

        assert ControlOption.objects.count() == 1
        assert ControlOption.objects.filter(value__exact="b").exists()

        assert Relay.objects.count() == 1
        assert Relay.objects.filter(public_key__exact=old_relay_public_key).exists()

        assert RelayUsage.objects.count() == 1
        assert RelayUsage.objects.filter(public_key__exact=old_relay_usage_public_key).exists()

        actual_user_role = UserRole.objects.first()
        assert len(actual_user_role.permissions) == len(old_user_role_permissions)
        for i, actual_permission in enumerate(actual_user_role.permissions):
            assert actual_permission == old_user_role_permissions[i]

    def test_colliding_configs_overwrite_configs_disabled_in_config_scope(self):
        owner = self.create_exhaustive_user("owner", is_admin=True)
        self.create_exhaustive_global_configs(owner)

        # Take note of the configs we want to track - this is the one we'll be importing.
        colliding_option = Option.objects.all().first()
        colliding_control_option = ControlOption.objects.all().first()
        colliding_relay = Relay.objects.all().first()
        colliding_relay_usage = RelayUsage.objects.all().first()
        colliding_user_role = UserRole.objects.all().first()

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)

            colliding_option.value = "y"
            colliding_option.save()

            colliding_control_option.value = "z"
            colliding_control_option.save()

            colliding_relay.public_key = "invalid"
            colliding_relay.save()

            colliding_relay_usage.public_key = "invalid"
            colliding_relay_usage.save()

            colliding_user_role.permissions = ["other.admin"]
            colliding_user_role.save()

            assert Option.objects.count() == 1
            assert ControlOption.objects.count() == 1
            assert Relay.objects.count() == 1
            assert RelayUsage.objects.count() == 1
            assert UserRole.objects.count() == 1

            with open(tmp_path) as tmp_file:
                import_in_config_scope(
                    tmp_file, flags=ImportFlags(overwrite_configs=False), printer=NOOP_PRINTER
                )

        assert Option.objects.count() == 1
        assert Option.objects.filter(value__exact="y").exists()

        assert ControlOption.objects.count() == 1
        assert ControlOption.objects.filter(value__exact="z").exists()

        assert Relay.objects.count() == 1
        assert Relay.objects.filter(public_key__exact="invalid").exists()

        assert RelayUsage.objects.count() == 1
        assert RelayUsage.objects.filter(public_key__exact="invalid").exists()

        assert UserRole.objects.count() == 1
        actual_user_role = UserRole.objects.first()
        assert len(actual_user_role.permissions) == 1
        assert actual_user_role.permissions[0] == "other.admin"

    def test_colliding_configs_overwrite_configs_enabled_in_global_scope(self):
        owner = self.create_exhaustive_user("owner", is_admin=True)
        self.create_exhaustive_global_configs(owner)

        # Take note of the configs we want to track - this is the one we'll be importing.
        colliding_option = Option.objects.all().first()
        colliding_control_option = ControlOption.objects.all().first()
        colliding_relay = Relay.objects.all().first()
        colliding_relay_usage = RelayUsage.objects.all().first()
        colliding_user_role = UserRole.objects.all().first()

        old_relay_public_key = colliding_relay.public_key
        old_relay_usage_public_key = colliding_relay_usage.public_key
        old_user_role_permissions = colliding_user_role.permissions

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)

            colliding_option.value = "y"
            colliding_option.save()

            colliding_control_option.value = "z"
            colliding_control_option.save()

            colliding_relay.public_key = "invalid"
            colliding_relay.save()

            colliding_relay_usage.public_key = "invalid"
            colliding_relay_usage.save()

            colliding_user_role.permissions = ["other.admin"]
            colliding_user_role.save()

            assert Option.objects.count() == 1
            assert ControlOption.objects.count() == 1
            assert Relay.objects.count() == 1
            assert RelayUsage.objects.count() == 1
            assert UserRole.objects.count() == 1

            with open(tmp_path) as tmp_file:
                import_in_global_scope(
                    tmp_file, flags=ImportFlags(overwrite_configs=True), printer=NOOP_PRINTER
                )

        assert Option.objects.count() == 1
        assert Option.objects.filter(value__exact="a").exists()

        assert ControlOption.objects.count() == 1
        assert ControlOption.objects.filter(value__exact="b").exists()

        assert Relay.objects.count() == 1
        assert Relay.objects.filter(public_key__exact=old_relay_public_key).exists()

        assert RelayUsage.objects.count() == 1
        assert RelayUsage.objects.filter(public_key__exact=old_relay_usage_public_key).exists()

        actual_user_role = UserRole.objects.first()
        assert len(actual_user_role.permissions) == len(old_user_role_permissions)
        for i, actual_permission in enumerate(actual_user_role.permissions):
            assert actual_permission == old_user_role_permissions[i]

    def test_colliding_configs_overwrite_configs_disabled_in_global_scope(self):
        owner = self.create_exhaustive_user("owner", is_admin=True)
        self.create_exhaustive_global_configs(owner)

        # Take note of the configs we want to track - this is the one we'll be importing.
        colliding_option = Option.objects.all().first()
        colliding_control_option = ControlOption.objects.all().first()
        colliding_relay = Relay.objects.all().first()
        colliding_relay_usage = RelayUsage.objects.all().first()
        colliding_user_role = UserRole.objects.all().first()

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)

            colliding_option.value = "y"
            colliding_option.save()

            colliding_control_option.value = "z"
            colliding_control_option.save()

            colliding_relay.public_key = "invalid"
            colliding_relay.save()

            colliding_relay_usage.public_key = "invalid"
            colliding_relay_usage.save()

            colliding_user_role.permissions = ["other.admin"]
            colliding_user_role.save()

            assert Option.objects.count() == 1
            assert ControlOption.objects.count() == 1
            assert Relay.objects.count() == 1
            assert RelayUsage.objects.count() == 1
            assert UserRole.objects.count() == 1

            with open(tmp_path) as tmp_file:
                import_in_global_scope(
                    tmp_file, flags=ImportFlags(overwrite_configs=False), printer=NOOP_PRINTER
                )

        assert Option.objects.count() == 1
        assert Option.objects.filter(value__exact="y").exists()

        assert ControlOption.objects.count() == 1
        assert ControlOption.objects.filter(value__exact="z").exists()

        assert Relay.objects.count() == 1
        assert Relay.objects.filter(public_key__exact="invalid").exists()

        assert RelayUsage.objects.count() == 1
        assert RelayUsage.objects.filter(public_key__exact="invalid").exists()

        assert UserRole.objects.count() == 1
        actual_user_role = UserRole.objects.first()
        assert len(actual_user_role.permissions) == 1
        assert actual_user_role.permissions[0] == "other.admin"

    def test_colliding_user_with_merging_enabled_in_user_scope(self):
        self.create_exhaustive_user(username="owner", email="importing@example.com")

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path) as tmp_file:
                self.create_exhaustive_user(username="owner", email="existing@example.com")
                import_in_user_scope(
                    tmp_file,
                    flags=ImportFlags(merge_users=True),
                    printer=NOOP_PRINTER,
                )

        assert User.objects.count() == 1
        assert UserIP.objects.count() == 1
        assert UserEmail.objects.count() == 1  # UserEmail gets overwritten
        assert Authenticator.objects.count() == 1
        assert Email.objects.count() == 2

        assert User.objects.filter(username__iexact="owner").exists()
        assert not User.objects.filter(username__iexact="owner-").exists()

        assert User.objects.filter(is_unclaimed=True).count() == 0
        assert User.objects.filter(is_unclaimed=False).count() == 1

        assert UserEmail.objects.filter(email__icontains="existing@").exists()
        assert not UserEmail.objects.filter(email__icontains="importing@").exists()

    def test_colliding_user_with_merging_disabled_in_user_scope(self):
        self.create_exhaustive_user(username="owner", email="importing@example.com")

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path) as tmp_file:
                self.create_exhaustive_user(username="owner", email="existing@example.com")
                import_in_user_scope(
                    tmp_file,
                    flags=ImportFlags(merge_users=False),
                    printer=NOOP_PRINTER,
                )

        assert User.objects.count() == 2
        assert UserIP.objects.count() == 2
        assert UserEmail.objects.count() == 2
        assert Authenticator.objects.count() == 1  # Only imported in global scope
        assert Email.objects.count() == 2

        assert User.objects.filter(username__iexact="owner").exists()
        assert User.objects.filter(username__icontains="owner-").exists()

        assert User.objects.filter(is_unclaimed=True).count() == 1
        assert User.objects.filter(is_unclaimed=False).count() == 1

        assert UserEmail.objects.filter(email__icontains="existing@").exists()
        assert UserEmail.objects.filter(email__icontains="importing@").exists()

    def test_colliding_user_with_merging_enabled_in_organization_scope(self):
        owner = self.create_exhaustive_user(username="owner", email="importing@example.com")
        self.create_organization("some-org", owner=owner)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path) as tmp_file:
                owner = self.create_exhaustive_user(username="owner", email="existing@example.com")
                self.create_organization("some-org", owner=owner)
                import_in_organization_scope(
                    tmp_file,
                    flags=ImportFlags(merge_users=True),
                    printer=NOOP_PRINTER,
                )

        assert User.objects.count() == 1
        assert UserIP.objects.count() == 1
        assert UserEmail.objects.count() == 1  # UserEmail gets overwritten
        assert Authenticator.objects.count() == 1  # Only imported in global scope
        assert Email.objects.count() == 2

        assert User.objects.filter(username__iexact="owner").exists()
        assert not User.objects.filter(username__icontains="owner-").exists()

        assert User.objects.filter(is_unclaimed=True).count() == 0
        assert User.objects.filter(is_unclaimed=False).count() == 1

        assert UserEmail.objects.filter(email__icontains="existing@").exists()
        assert not UserEmail.objects.filter(email__icontains="importing@").exists()

        assert Organization.objects.count() == 2
        assert OrganizationMapping.objects.count() == 2
        assert OrganizationMember.objects.count() == 2  # Same user in both orgs
        assert OrganizationMemberMapping.objects.count() == 2  # Same user in both orgs

        user = User.objects.get(username="owner")
        existing = Organization.objects.get(slug="some-org")
        imported = Organization.objects.filter(slug__icontains="some-org-").first()
        assert (
            OrganizationMember.objects.filter(user_id=user.id, organization=existing).count() == 1
        )
        assert (
            OrganizationMember.objects.filter(user_id=user.id, organization=imported).count() == 1
        )
        assert (
            OrganizationMemberMapping.objects.filter(user=user, organization_id=existing.id).count()
            == 1
        )
        assert (
            OrganizationMemberMapping.objects.filter(user=user, organization_id=imported.id).count()
            == 1
        )

    def test_colliding_user_with_merging_disabled_in_organization_scope(self):
        owner = self.create_exhaustive_user(username="owner", email="importing@example.com")
        self.create_organization("some-org", owner=owner)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path) as tmp_file:
                owner = self.create_exhaustive_user(username="owner", email="existing@example.com")
                self.create_organization("some-org", owner=owner)
                import_in_organization_scope(
                    tmp_file,
                    flags=ImportFlags(merge_users=False),
                    printer=NOOP_PRINTER,
                )

        assert User.objects.count() == 2
        assert UserIP.objects.count() == 2
        assert UserEmail.objects.count() == 2
        assert Authenticator.objects.count() == 1  # Only imported in global scope
        assert Email.objects.count() == 2

        assert User.objects.filter(username__iexact="owner").exists()
        assert User.objects.filter(username__icontains="owner-").exists()

        assert User.objects.filter(is_unclaimed=True).count() == 1
        assert User.objects.filter(is_unclaimed=False).count() == 1

        assert UserEmail.objects.filter(email__icontains="existing@").exists()
        assert UserEmail.objects.filter(email__icontains="importing@").exists()

        assert Organization.objects.count() == 2
        assert OrganizationMapping.objects.count() == 2
        assert OrganizationMember.objects.count() == 2
        assert OrganizationMemberMapping.objects.count() == 2

        existing_user = User.objects.get(username="owner")
        imported_user = User.objects.get(username__icontains="owner-")
        existing_org = Organization.objects.get(slug="some-org")
        imported_org = Organization.objects.filter(slug__icontains="some-org-").first()
        assert (
            OrganizationMember.objects.filter(
                user_id=existing_user.id, organization=existing_org
            ).count()
            == 1
        )
        assert (
            OrganizationMember.objects.filter(
                user_id=imported_user.id, organization=imported_org
            ).count()
            == 1
        )
        assert (
            OrganizationMemberMapping.objects.filter(
                user=existing_user, organization_id=existing_org.id
            ).count()
            == 1
        )
        assert (
            OrganizationMemberMapping.objects.filter(
                user=imported_user, organization_id=imported_org.id
            ).count()
            == 1
        )

    def test_colliding_user_with_merging_enabled_in_config_scope(self):
        self.create_exhaustive_user(username="owner", email="importing@example.com", is_admin=True)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path) as tmp_file:
                self.create_exhaustive_user(
                    username="owner", email="existing@example.com", is_admin=True
                )
                import_in_config_scope(
                    tmp_file,
                    flags=ImportFlags(merge_users=True),
                    printer=NOOP_PRINTER,
                )

        assert User.objects.count() == 1
        assert UserIP.objects.count() == 1
        assert UserEmail.objects.count() == 1  # UserEmail gets overwritten
        assert UserPermission.objects.count() == 1
        assert Authenticator.objects.count() == 1
        assert Email.objects.count() == 2

        assert User.objects.filter(username__iexact="owner").exists()
        assert not User.objects.filter(username__iexact="owner-").exists()

        assert User.objects.filter(is_unclaimed=True).count() == 0
        assert User.objects.filter(is_unclaimed=False).count() == 1

        assert UserEmail.objects.filter(email__icontains="existing@").exists()
        assert not UserEmail.objects.filter(email__icontains="importing@").exists()

    def test_colliding_user_with_merging_disabled_in_config_scope(self):
        self.create_exhaustive_user(username="owner", email="importing@example.com", is_admin=True)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path) as tmp_file:
                self.create_exhaustive_user(
                    username="owner", email="existing@example.com", is_admin=True
                )
                import_in_config_scope(
                    tmp_file,
                    flags=ImportFlags(merge_users=False),
                    printer=NOOP_PRINTER,
                )

        assert User.objects.count() == 2
        assert UserIP.objects.count() == 2
        assert UserEmail.objects.count() == 2
        assert UserPermission.objects.count() == 2
        assert Authenticator.objects.count() == 1  # Only imported in global scope
        assert Email.objects.count() == 2

        assert User.objects.filter(username__iexact="owner").exists()
        assert User.objects.filter(username__icontains="owner-").exists()

        assert User.objects.filter(is_unclaimed=True).count() == 1
        assert User.objects.filter(is_unclaimed=False).count() == 1

        assert UserEmail.objects.filter(email__icontains="existing@").exists()
        assert UserEmail.objects.filter(email__icontains="importing@").exists()
