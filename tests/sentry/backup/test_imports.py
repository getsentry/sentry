from __future__ import annotations

import io
import os
import tarfile
import tempfile
from datetime import UTC, date, datetime
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import orjson
import pytest
import urllib3.exceptions
from cryptography.fernet import Fernet
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from django.db import connections, router
from django.db.models import Model
from django.utils import timezone

from sentry.backup.crypto import LocalFileDecryptor
from sentry.backup.dependencies import NormalizedModelName, dependencies, get_model, get_model_name
from sentry.backup.helpers import ImportFlags
from sentry.backup.imports import (
    MAX_BATCH_SIZE,
    ImportingError,
    import_in_config_scope,
    import_in_global_scope,
    import_in_organization_scope,
    import_in_user_scope,
)
from sentry.backup.scopes import ExportScope, ImportScope, RelocationScope
from sentry.backup.services.import_export.model import RpcImportErrorKind
from sentry.models.apitoken import DEFAULT_EXPIRATION, ApiToken, generate_token
from sentry.models.importchunk import (
    ControlImportChunk,
    ControlImportChunkReplica,
    RegionImportChunk,
)
from sentry.models.options.option import ControlOption, Option
from sentry.models.options.project_option import ProjectOption
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.models.organizationslugreservation import (
    OrganizationSlugReservation,
    OrganizationSlugReservationType,
)
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.models.project import Project
from sentry.models.projectkey import ProjectKey
from sentry.models.relay import Relay, RelayUsage
from sentry.models.savedsearch import SavedSearch, Visibility
from sentry.models.team import Team
from sentry.monitors.models import Monitor
from sentry.receivers import create_default_projects
from sentry.silo.base import SiloMode
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.backups import (
    NOOP_PRINTER,
    BackupTransactionTestCase,
    clear_database,
    export_to_file,
    generate_rsa_key_pair,
    is_control_model,
)
from sentry.testutils.hybrid_cloud import use_split_dbs
from sentry.testutils.silo import assume_test_silo_mode
from sentry.users.models.authenticator import Authenticator
from sentry.users.models.email import Email
from sentry.users.models.lostpasswordhash import LostPasswordHash
from sentry.users.models.user import User
from sentry.users.models.user_option import UserOption
from sentry.users.models.useremail import UserEmail
from sentry.users.models.userip import UserIP
from sentry.users.models.userpermission import UserPermission
from sentry.users.models.userrole import UserRole, UserRoleUser
from tests.sentry.backup import (
    expect_models,
    get_matching_exportable_models,
    verify_models_in_output,
)


class ImportTestCase(BackupTransactionTestCase):
    def export_to_tmp_file_and_clear_database(self, tmp_dir) -> Path:
        tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
        export_to_file(tmp_path, ExportScope.Global)
        clear_database()
        return tmp_path


class SanitizationTests(ImportTestCase):
    """
    Ensure that potentially damaging data is properly scrubbed at import time.
    """

    def test_users_sanitized_in_user_scope(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            self.generate_tmp_users_json_file(tmp_path)
            with open(tmp_path, "rb") as tmp_file:
                import_in_user_scope(tmp_file, printer=NOOP_PRINTER)

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert User.objects.count() == 4
            assert (
                User.objects.filter(is_managed=False, is_staff=False, is_superuser=False).count()
                == 4
            )

            # Every user except `max_user` shares an email.
            assert Email.objects.count() == 2

            # All `UserEmail`s must have their verification status reset in this scope.
            assert UserEmail.objects.count() == 4
            assert UserEmail.objects.filter(is_verified=True).count() == 0
            assert (
                UserEmail.objects.filter(
                    date_hash_added__lt=datetime(2023, 7, 1, 0, 0, tzinfo=UTC)
                ).count()
                == 0
            )
            assert (
                UserEmail.objects.filter(validation_hash="mCnWesSVvYQcq7qXQ36AZHwosAd6cghE").count()
                == 0
            )

            assert User.objects.filter(is_unclaimed=True).count() == 4
            assert LostPasswordHash.objects.count() == 4
            assert User.objects.filter(is_managed=True).count() == 0
            assert User.objects.filter(is_staff=True).count() == 0
            assert User.objects.filter(is_superuser=True).count() == 0
            assert Authenticator.objects.count() == 0
            assert UserPermission.objects.count() == 0
            assert UserRole.objects.count() == 0
            assert UserRoleUser.objects.count() == 0

    def test_users_sanitized_in_organization_scope(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            self.generate_tmp_users_json_file(tmp_path)
            with open(tmp_path, "rb") as tmp_file:
                import_in_organization_scope(tmp_file, printer=NOOP_PRINTER)

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert User.objects.count() == 4
            assert (
                User.objects.filter(is_managed=False, is_staff=False, is_superuser=False).count()
                == 4
            )

            # Every user except `max_user` shares an email.
            assert Email.objects.count() == 2

            # All `UserEmail`s must have their verification status reset in this scope.
            assert UserEmail.objects.count() == 4
            assert UserEmail.objects.filter(is_verified=True).count() == 0
            assert (
                UserEmail.objects.filter(
                    date_hash_added__lt=datetime(2023, 7, 1, 0, 0, tzinfo=UTC)
                ).count()
                == 0
            )
            assert (
                UserEmail.objects.filter(validation_hash="mCnWesSVvYQcq7qXQ36AZHwosAd6cghE").count()
                == 0
            )

            assert User.objects.filter(is_unclaimed=True).count() == 4
            assert LostPasswordHash.objects.count() == 4
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
            self.generate_tmp_users_json_file(tmp_path)
            with open(tmp_path, "rb") as tmp_file:
                import_in_config_scope(tmp_file, printer=NOOP_PRINTER)

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert User.objects.count() == 4
            assert User.objects.filter(is_unclaimed=True).count() == 4
            assert LostPasswordHash.objects.count() == 4
            assert User.objects.filter(is_managed=True).count() == 1
            assert User.objects.filter(is_staff=True).count() == 2
            assert User.objects.filter(is_superuser=True).count() == 2
            assert (
                User.objects.filter(is_managed=False, is_staff=False, is_superuser=False).count()
                == 2
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
            assert (
                UserEmail.objects.filter(
                    date_hash_added__lt=datetime(2023, 7, 1, 0, 0, tzinfo=UTC)
                ).count()
                == 0
            )
            assert (
                UserEmail.objects.filter(validation_hash="mCnWesSVvYQcq7qXQ36AZHwosAd6cghE").count()
                == 0
            )

            # 1 from `max_user`, 1 from `permission_user`.
            assert UserPermission.objects.count() == 2

            # 1 from `max_user`.
            assert UserRole.objects.count() == 1
            assert UserRoleUser.objects.count() == 2

    def test_users_unsanitized_in_global_scope(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            self.generate_tmp_users_json_file(tmp_path)
            with open(tmp_path, "rb") as tmp_file:
                import_in_global_scope(tmp_file, printer=NOOP_PRINTER)

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert User.objects.count() == 4
            # We don't mark `Global`ly imported `User`s unclaimed.
            assert User.objects.filter(is_unclaimed=True).count() == 0
            assert LostPasswordHash.objects.count() == 0
            assert User.objects.filter(is_managed=True).count() == 1
            assert User.objects.filter(is_staff=True).count() == 2
            assert User.objects.filter(is_superuser=True).count() == 2
            assert (
                User.objects.filter(is_managed=False, is_staff=False, is_superuser=False).count()
                == 2
            )
            assert UserEmail.objects.count() == 4

            # Unlike the "config" scope, we keep authentication information for the "global" scope.
            assert Authenticator.objects.count() == 4

            # Every user except `max_user` shares an email.
            assert Email.objects.count() == 2

            # All `UserEmail`s must have their imported verification status reset in this scope.
            assert UserEmail.objects.count() == 4
            assert UserEmail.objects.filter(is_verified=True).count() == 4
            assert (
                UserEmail.objects.filter(
                    date_hash_added__lt=datetime(2023, 7, 1, 0, 0, tzinfo=UTC)
                ).count()
                == 4
            )
            assert (
                UserEmail.objects.filter(validation_hash="mCnWesSVvYQcq7qXQ36AZHwosAd6cghE").count()
                == 4
            )

            # 1 from `max_user`, 1 from `permission_user`.
            assert UserPermission.objects.count() == 2

            # 1 from `max_user`.
            assert UserRole.objects.count() == 1
            assert UserRoleUser.objects.count() == 2

    def test_generate_suffix_for_already_taken_organization(self):
        owner = self.create_user(email="testing@example.com")
        self.create_organization(name="some-org", owner=owner)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)

            # Note that we have created an organization with the same name as one we are about to
            # import.
            existing_org = self.create_organization(owner=self.user, name="some-org")
            with open(tmp_path, "rb") as tmp_file:
                import_in_organization_scope(tmp_file, printer=NOOP_PRINTER)

        assert Organization.objects.count() == 2
        assert Organization.objects.filter(slug__icontains="some-org").count() == 2
        assert Organization.objects.filter(slug__iexact="some-org").count() == 1

        imported_organization = Organization.objects.get(slug__icontains="some-org-")
        assert imported_organization.id != existing_org.id

        org_chunk = RegionImportChunk.objects.get(
            model="sentry.organization", min_ordinal=1, max_ordinal=1
        )
        assert len(org_chunk.inserted_map) == 1
        assert len(org_chunk.inserted_identifiers) == 1
        for slug in org_chunk.inserted_identifiers.values():
            assert slug.startswith("some-org-")

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert (
                OrganizationSlugReservation.objects.filter(
                    slug__icontains="some-org",
                    reservation_type=OrganizationSlugReservationType.PRIMARY,
                ).count()
                == 2
            )

            assert OrganizationSlugReservation.objects.filter(slug__iexact="some-org").count() == 1
            # Assert that the slug update RPC has completed and generated a valid matching primary
            # slug reservation.
            slug_reservation = OrganizationSlugReservation.objects.filter(
                slug__icontains="some-org-",
                reservation_type=OrganizationSlugReservationType.PRIMARY,
            ).get()

            assert OrganizationMapping.objects.count() == 2
            assert OrganizationMapping.objects.filter(slug__icontains="some-org").count() == 2
            assert OrganizationMapping.objects.filter(slug__iexact="some-org").count() == 1
            org_mapping = OrganizationMapping.objects.get(slug__icontains="some-org-")
            assert org_mapping.slug == slug_reservation.slug == imported_organization.slug
            assert (
                org_mapping.organization_id
                == slug_reservation.organization_id
                == imported_organization.id
            )

    def test_generate_suffix_for_already_taken_organization_with_control_option(self):
        with override_options({"hybrid_cloud.control-organization-provisioning": True}):
            self.test_generate_suffix_for_already_taken_organization()

    def test_generate_suffix_for_already_taken_username(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            self.create_user("min_user")
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            with open(tmp_path, "wb+") as tmp_file:
                models = self.json_of_exhaustive_user_with_minimum_privileges()
                tmp_file.write(orjson.dumps(self.sort_in_memory_json(models)))

            # Import twice, to check that new suffixes are assigned both times.
            with open(tmp_path, "rb") as tmp_file:
                import_in_user_scope(tmp_file, printer=NOOP_PRINTER)
            with open(tmp_path, "rb") as tmp_file:
                import_in_user_scope(tmp_file, printer=NOOP_PRINTER)

            with assume_test_silo_mode(SiloMode.CONTROL):
                assert User.objects.count() == 3
                assert (
                    User.objects.filter(username__icontains="min_user")
                    .values("username")
                    .distinct()
                    .count()
                    == 3
                )
                assert User.objects.filter(username__iexact="min_user").count() == 1
                assert User.objects.filter(username__icontains="min_user-").count() == 2

    def test_bad_invalid_user(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            with open(tmp_path, "wb+") as tmp_file:
                models = self.json_of_exhaustive_user_with_minimum_privileges()

                # Modify all username to be longer than 128 characters.
                for model in models:
                    if model["model"] == "sentry.user":
                        model["fields"]["username"] = "x" * 129
                tmp_file.write(orjson.dumps(models))

            with open(tmp_path, "rb") as tmp_file:
                with pytest.raises(ImportingError) as err:
                    import_in_user_scope(tmp_file, printer=NOOP_PRINTER)

                assert err.value.context.get_kind() == RpcImportErrorKind.ValidationError
                assert err.value.context.on.model == "sentry.user"

    @patch("sentry.users.models.userip.geo_by_addr")
    def test_good_regional_user_ip_in_global_scope(self, mock_geo_by_addr):
        mock_geo_by_addr.return_value = {
            "country_code": "US",
            "region": "CA",
            "subdivision": "San Francisco",
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            with open(tmp_path, "wb+") as tmp_file:
                models = self.json_of_exhaustive_user_with_minimum_privileges()

                # Modify the UserIP to be in California, USA.
                for model in models:
                    if model["model"] == "sentry.userip":
                        model["fields"]["ip_address"] = "8.8.8.8"
                tmp_file.write(orjson.dumps(models))

            with open(tmp_path, "rb") as tmp_file:
                import_in_global_scope(tmp_file, printer=NOOP_PRINTER)

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert UserIP.objects.count() == 1
            assert UserIP.objects.filter(ip_address="8.8.8.8").exists()
            assert UserIP.objects.filter(country_code="US").exists()
            assert UserIP.objects.filter(region_code="CA").exists()

            # Unlike org/user scope, this must NOT be reset.
            assert not UserIP.objects.filter(
                last_seen__gt=datetime(2023, 7, 1, 0, 0, tzinfo=UTC)
            ).exists()
            assert not UserIP.objects.filter(
                first_seen__gt=datetime(2023, 7, 1, 0, 0, tzinfo=UTC)
            ).exists()

    # Regression test for getsentry/self-hosted#2468.
    @patch("sentry.users.models.userip.geo_by_addr")
    def test_good_multiple_user_ips_per_user_in_global_scope(self, mock_geo_by_addr):
        mock_geo_by_addr.return_value = {
            "country_code": "US",
            "region": "CA",
            "subdivision": "San Francisco",
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            with open(tmp_path, "wb+") as tmp_file:
                models = self.json_of_exhaustive_user_with_minimum_privileges()

                # Modify the UserIP to be in California, USA.
                for model in models:
                    if model["model"] == "sentry.userip":
                        model["fields"]["ip_address"] = "8.8.8.8"

                # Add a two copies of the same IP - so the user now has 2 `UserIP` models for the IP
                # `8.8.8.9`, 1 for `8.8.8.8`, and 1 for `8.8.8.7`. After import, we would expect to
                # only see one model for each IP.
                models.append(
                    {
                        "model": "sentry.userip",
                        "pk": 3,
                        "fields": {
                            "user": 2,
                            "ip_address": "8.8.8.9",
                            "country_code": "US",
                            "region_code": "CA",
                            "first_seen": "2013-04-05T03:29:45.000Z",
                            "last_seen": "2013-04-05T03:29:45.000Z",
                        },
                    }
                )
                models.append(
                    {
                        "model": "sentry.userip",
                        "pk": 4,
                        "fields": {
                            "user": 2,
                            "ip_address": "8.8.8.9",
                            "country_code": "CA",  # Incorrect value - importing should fix this.
                            "region_code": "BC",  # Incorrect value - importing should fix this.
                            "first_seen": "2014-04-05T03:29:45.000Z",
                            "last_seen": "2014-04-05T03:29:45.000Z",
                        },
                    }
                )
                models.append(
                    {
                        "model": "sentry.userip",
                        "pk": 4,
                        "fields": {
                            "user": 2,
                            "ip_address": "8.8.8.7",
                            "country_code": None,  # Unknown value - importing should fix this.
                            "region_code": None,  # Unknown value - importing should fix this.
                            "first_seen": "2014-04-05T03:29:45.000Z",
                            "last_seen": "2014-04-05T03:29:45.000Z",
                        },
                    }
                )

                tmp_file.write(orjson.dumps(self.sort_in_memory_json(models)))

            with open(tmp_path, "rb") as tmp_file:
                import_in_global_scope(tmp_file, printer=NOOP_PRINTER)

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert UserIP.objects.count() == 3
            assert UserIP.objects.filter(ip_address="8.8.8.9").count() == 1
            assert UserIP.objects.filter(ip_address="8.8.8.8").count() == 1
            assert UserIP.objects.filter(ip_address="8.8.8.7").count() == 1
            assert UserIP.objects.filter(country_code="US").count() == 3
            assert UserIP.objects.filter(region_code="CA").count() == 3

    def test_bad_invalid_user_ip(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            with open(tmp_path, "wb+") as tmp_file:
                models = self.json_of_exhaustive_user_with_minimum_privileges()

                # Modify the IP address to be in invalid.
                for m in models:
                    if m["model"] == "sentry.userip":
                        m["fields"]["ip_address"] = "0.1.2.3.4.5.6.7.8.9.abc.def"
                tmp_file.write(orjson.dumps(list(models)))

            with open(tmp_path, "rb") as tmp_file:
                with pytest.raises(ImportingError) as err:
                    import_in_global_scope(tmp_file, printer=NOOP_PRINTER)

                assert err.value.context.get_kind() == RpcImportErrorKind.ValidationError
                assert err.value.context.on.model == "sentry.userip"

    # Regression test for getsentry/self-hosted#2571.
    def test_good_multiple_useremails_per_user_in_user_scope(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            with open(tmp_path, "wb+") as tmp_file:
                models = self.json_of_exhaustive_user_with_minimum_privileges()

                # Add two copies (1 verified, 1 not) of the same `UserEmail` - so the user now has 3
                # `UserEmail` models, the latter of which have no corresponding `Email` entry.
                models.append(
                    {
                        "model": "sentry.useremail",
                        "pk": 100,
                        "fields": {
                            "user": 2,
                            "email": "second@example.com",
                            "validation_hash": "7jvwev0oc8sFyEyEwfvDAwxidtGzpAov",
                            "date_hash_added": "2023-06-22T22:59:56.521Z",
                            "is_verified": True,
                        },
                    }
                )
                models.append(
                    {
                        "model": "sentry.useremail",
                        "pk": 101,
                        "fields": {
                            "user": 2,
                            "email": "third@example.com",
                            "validation_hash": "",
                            "date_hash_added": "2023-06-22T22:59:57.521Z",
                            "is_verified": False,
                        },
                    }
                )

                tmp_file.write(orjson.dumps(self.sort_in_memory_json(models)))

            with open(tmp_path, "rb") as tmp_file:
                import_in_user_scope(tmp_file, printer=NOOP_PRINTER)

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert UserEmail.objects.count() == 3
            assert UserEmail.objects.values("user").distinct().count() == 1
            assert UserEmail.objects.filter(email="testing@example.com").exists()
            assert UserEmail.objects.filter(email="second@example.com").exists()
            assert UserEmail.objects.filter(email="third@example.com").exists()

            # Validations are scrubbed and regenerated in non-global scopes.
            assert UserEmail.objects.filter(validation_hash="").count() == 0
            assert UserEmail.objects.filter(is_verified=True).count() == 0

    # Regression test for getsentry/self-hosted#2571.
    def test_good_multiple_useremails_per_user_in_global_scope(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            with open(tmp_path, "wb+") as tmp_file:
                models = self.json_of_exhaustive_user_with_minimum_privileges()

                # Add two copies (1 verified, 1 not) of the same `UserEmail` - so the user now has 3
                # `UserEmail` models, the latter of which have no corresponding `Email` entry.
                models.append(
                    {
                        "model": "sentry.useremail",
                        "pk": 100,
                        "fields": {
                            "user": 2,
                            "email": "second@example.com",
                            "validation_hash": "7jvwev0oc8sFyEyEwfvDAwxidtGzpAov",
                            "date_hash_added": "2023-06-22T22:59:56.521Z",
                            "is_verified": True,
                        },
                    }
                )
                models.append(
                    {
                        "model": "sentry.useremail",
                        "pk": 101,
                        "fields": {
                            "user": 2,
                            "email": "third@example.com",
                            "validation_hash": "",
                            "date_hash_added": "2023-06-22T22:59:57.521Z",
                            "is_verified": False,
                        },
                    }
                )

                tmp_file.write(orjson.dumps(self.sort_in_memory_json(models)))

            with open(tmp_path, "rb") as tmp_file:
                import_in_global_scope(tmp_file, printer=NOOP_PRINTER)

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert UserEmail.objects.count() == 3
            assert UserEmail.objects.values("user").distinct().count() == 1
            assert UserEmail.objects.filter(email="testing@example.com").exists()
            assert UserEmail.objects.filter(email="second@example.com").exists()
            assert UserEmail.objects.filter(email="third@example.com").exists()

            # Validation hashes are not touched in the global scope.
            assert UserEmail.objects.filter(validation_hash="").count() == 1
            assert UserEmail.objects.filter(is_verified=True).count() == 2

    def test_bad_invalid_user_option(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            with open(tmp_path, "wb+") as tmp_file:
                models = self.json_of_exhaustive_user_with_minimum_privileges()

                # Modify the `timezone` option to be in invalid.
                for m in models:
                    if m["model"] == "sentry.useroption" and m["fields"]["key"] == "timezone":
                        m["fields"]["value"] = '"MiddleEarth/Gondor"'
                tmp_file.write(orjson.dumps(list(models)))

            with open(tmp_path, "rb") as tmp_file:
                with pytest.raises(ImportingError) as err:
                    import_in_user_scope(tmp_file, printer=NOOP_PRINTER)

                assert err.value.context.get_kind() == RpcImportErrorKind.ValidationError
                assert err.value.context.on.model == "sentry.useroption"


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
            with open(tmp_path, "rb") as tmp_file:
                import_in_user_scope(tmp_file, printer=NOOP_PRINTER)

        with assume_test_silo_mode(SiloMode.CONTROL):
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
            with open(tmp_path, "rb") as tmp_file:
                import_in_organization_scope(tmp_file, printer=NOOP_PRINTER)

        # There should only be 1 organization at this point
        imported_organization = Organization.objects.get()
        assert imported_organization.slug == "some-org"

        assert OrganizationMember.objects.count() == 3

        # The exhaustive org has 1 project which automatically gets 1 key and 3 options.
        assert Project.objects.count() == 1
        assert Project.objects.filter(name="project-some-org").exists()

        assert ProjectKey.objects.count() == 1
        assert ProjectOption.objects.count() == 1
        assert ProjectOption.objects.filter(key="sentry:option-epoch").exists()

        with assume_test_silo_mode(SiloMode.CONTROL):
            # An organization slug reservation with a valid primary reservation type
            # signals that we've synchronously resolved the slug update RPC correctly.
            assert OrganizationSlugReservation.objects.filter(
                organization_id=imported_organization.id,
                slug="some-org",
                reservation_type=OrganizationSlugReservationType.PRIMARY,
            ).exists()
            assert OrganizationMapping.objects.count() == 1
            assert OrganizationMapping.objects.filter(
                organization_id=imported_organization.id, slug="some-org"
            ).exists()
            assert OrganizationMemberMapping.objects.count() == 3

    def test_import_signaling_organization_with_control_provisioning_option(self):
        with override_options({"hybrid_cloud.control-organization-provisioning": True}):
            self.test_import_signaling_organization()


class ScopingTests(ImportTestCase):
    """
    Ensures that only models with the allowed relocation scopes are actually imported.
    """

    @staticmethod
    def verify_model_inclusion(scope: ImportScope):
        """
        Ensure all in-scope models are included, and that no out-of-scope models are included.
        Additionally, we verify that each such model had an appropriate `*ImportChunk` written out
        atomically alongside it.
        """
        included_models = get_matching_exportable_models(
            lambda mr: len(mr.get_possible_relocation_scopes() & scope.value) > 0
        )
        excluded_models = get_matching_exportable_models(
            lambda mr: mr.get_possible_relocation_scopes() != {RelocationScope.Excluded}
            and not (mr.get_possible_relocation_scopes() & scope.value)
        )

        for model in included_models:
            model_name_str = str(get_model_name(model))
            if is_control_model(model):
                replica = ControlImportChunkReplica.objects.filter(model=model_name_str).first()
                assert replica is not None

                with assume_test_silo_mode(SiloMode.CONTROL):
                    assert model.objects.count() > 0

                    control = ControlImportChunk.objects.filter(model=model_name_str).first()
                    assert control is not None

                    # Ensure that the region-silo replica and the control-silo original are
                    # identical.
                    common_fields = {f.name for f in ControlImportChunk._meta.get_fields()} - {
                        "id",
                        "date_added",
                        "date_updated",
                    }
                    for field in common_fields:
                        assert getattr(replica, field, None) == getattr(control, field, None)
            else:
                assert model.objects.count() > 0
                assert RegionImportChunk.objects.filter(model=model_name_str).count() == 1

        for model in excluded_models:
            if is_control_model(model):
                with assume_test_silo_mode(SiloMode.CONTROL):
                    assert model.objects.count() == 0
            else:
                assert model.objects.count() == 0

    def test_user_import_scoping(self):
        self.create_exhaustive_instance(is_superadmin=True)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path, "rb") as tmp_file:
                import_in_user_scope(tmp_file, printer=NOOP_PRINTER)
                self.verify_model_inclusion(ImportScope.User)

        # Test that the import UUID is auto-assigned properly.
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert ControlImportChunk.objects.values("import_uuid").distinct().count() == 1

        assert ControlImportChunkReplica.objects.values("import_uuid").distinct().count() == 1

    def test_organization_import_scoping(self):
        self.create_exhaustive_instance(is_superadmin=True)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path, "rb") as tmp_file:
                import_in_organization_scope(tmp_file, printer=NOOP_PRINTER)
                self.verify_model_inclusion(ImportScope.Organization)

        # Test that the import UUID is auto-assigned properly.
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert ControlImportChunk.objects.values("import_uuid").distinct().count() == 1

        assert ControlImportChunkReplica.objects.values("import_uuid").distinct().count() == 1
        assert RegionImportChunk.objects.values("import_uuid").distinct().count() == 1
        assert (
            ControlImportChunkReplica.objects.values("import_uuid").first()
            == RegionImportChunk.objects.values("import_uuid").first()
        )

    def test_config_import_scoping(self):
        self.create_exhaustive_instance(is_superadmin=True)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path, "rb") as tmp_file:
                import_in_config_scope(tmp_file, printer=NOOP_PRINTER)
                self.verify_model_inclusion(ImportScope.Config)

        # Test that the import UUID is auto-assigned properly.
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert ControlImportChunk.objects.values("import_uuid").distinct().count() == 1

        assert ControlImportChunkReplica.objects.values("import_uuid").distinct().count() == 1
        assert RegionImportChunk.objects.values("import_uuid").distinct().count() == 1
        assert (
            ControlImportChunkReplica.objects.values("import_uuid").first()
            == RegionImportChunk.objects.values("import_uuid").first()
        )

    def test_global_import_scoping(self):
        self.create_exhaustive_instance(is_superadmin=True)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path, "rb") as tmp_file:
                import_in_global_scope(tmp_file, printer=NOOP_PRINTER)
                self.verify_model_inclusion(ImportScope.Global)

        # Test that the import UUID is auto-assigned properly.
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert ControlImportChunk.objects.values("import_uuid").distinct().count() == 1

        assert ControlImportChunkReplica.objects.values("import_uuid").distinct().count() == 1
        assert RegionImportChunk.objects.values("import_uuid").distinct().count() == 1
        assert (
            ControlImportChunkReplica.objects.values("import_uuid").first()
            == RegionImportChunk.objects.values("import_uuid").first()
        )


class DatabaseResetTests(ImportTestCase):
    """
    Ensure that database resets work as intended in different import scopes.
    """

    def import_empty_backup_file(self, import_fn):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_empty_file_path = tmp_dir + "empty_backup.json"
            with open(tmp_empty_file_path, "wb") as tmp_file:
                tmp_file.write(orjson.dumps([]))
            with open(tmp_empty_file_path, "rb") as empty_backup_json:
                import_fn(empty_backup_json, printer=NOOP_PRINTER)

    @pytest.mark.skipif(
        os.environ.get("SENTRY_USE_MONOLITH_DBS", "0") == "0",
        reason="only run when in `SENTRY_USE_MONOLITH_DBS=1` env variable is set",
    )
    def test_clears_existing_models_in_global_scope(self):
        create_default_projects()
        self.import_empty_backup_file(import_in_global_scope)

        for dependency in dependencies():
            model = get_model(dependency)
            assert model is not None
            assert model.objects.count() == 0
            with connections[router.db_for_read(model)].cursor() as cursor:
                cursor.execute(f"SELECT MAX(id) FROM {model._meta.db_table}")
                sequence_number = cursor.fetchone()[0]
                assert sequence_number == 1 or sequence_number is None

        # During the setup of a fresh Sentry instance, there are a couple of models that are
        # automatically created: the Sentry org, a Sentry team, and an internal project. During a
        # global import, we want to avoid persisting these default models and start from scratch.
        # These explicit assertions are here just to double check that these models have been wiped.
        assert Project.objects.count() == 0
        assert ProjectKey.objects.count() == 0
        assert Organization.objects.count() == 0
        assert OrganizationMember.objects.count() == 0
        assert Team.objects.count() == 0

        with tempfile.TemporaryDirectory() as tmp_dir:
            path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            export_to_file(path, ExportScope.Global)
            with open(path) as tmp_file:
                assert tmp_file.read() == "[]"

    def test_persist_existing_models_in_user_scope(self):
        owner = self.create_exhaustive_user("owner", email="owner@example.com")
        user = self.create_exhaustive_user("user", email="user@example.com")
        self.create_exhaustive_organization("neworg", owner, user, None)
        assert Organization.objects.count() == 1
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert User.objects.count() == 3
        self.import_empty_backup_file(import_in_user_scope)
        assert Organization.objects.count() == 1
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert User.objects.count() == 3

    def test_persist_existing_models_in_config_scope(self):
        owner = self.create_exhaustive_user("owner", email="owner@example.com")
        user = self.create_exhaustive_user("user", email="user@example.com")
        self.create_exhaustive_organization("neworg", owner, user, None)
        assert Organization.objects.count() == 1
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert User.objects.count() == 3
        self.import_empty_backup_file(import_in_config_scope)
        assert Organization.objects.count() == 1
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert User.objects.count() == 3

    def test_persist_existing_models_in_organization_scope(self):
        owner = self.create_exhaustive_user("owner", email="owner@example.com")
        user = self.create_exhaustive_user("user", email="user@example.com")
        self.create_exhaustive_organization("neworg", owner, user, None)
        assert Organization.objects.count() == 1
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert User.objects.count() == 3
        self.import_empty_backup_file(import_in_organization_scope)
        assert Organization.objects.count() == 1
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert User.objects.count() == 3


# Filters should work identically in both silo and monolith modes, so no need to repeat the tests
# here.
class DecryptionTests(ImportTestCase):
    """
    Ensures that decryption actually works. We only test one model for each scope, because it's
    extremely unlikely that a failed decryption will leave only part of the data unmangled.
    """

    @staticmethod
    def encrypt_json_fixture(tmp_dir) -> tuple[Path, Path]:
        good_file_path = get_fixture_path("backup", "fresh-install.json")
        (priv_key_pem, pub_key_pem) = generate_rsa_key_pair()

        tmp_priv_key_path = Path(tmp_dir).joinpath("key")
        with open(tmp_priv_key_path, "wb") as f:
            f.write(priv_key_pem)

        tmp_pub_key_path = Path(tmp_dir).joinpath("key.pub")
        with open(tmp_pub_key_path, "wb") as f:
            f.write(pub_key_pem)

        with open(good_file_path, "rb") as f:
            json_data = orjson.loads(f.read())

        tmp_tarball_path = Path(tmp_dir).joinpath("input.tar")
        with open(tmp_tarball_path, "wb") as i, open(tmp_pub_key_path, "rb") as p:
            pem = p.read()
            data_encryption_key = Fernet.generate_key()
            backup_encryptor = Fernet(data_encryption_key)
            encrypted_json_export = backup_encryptor.encrypt(orjson.dumps(json_data))

            dek_encryption_key = serialization.load_pem_public_key(pem, default_backend())
            sha256 = hashes.SHA256()
            mgf = padding.MGF1(algorithm=sha256)
            oaep_padding = padding.OAEP(mgf=mgf, algorithm=sha256, label=None)
            encrypted_dek = dek_encryption_key.encrypt(data_encryption_key, oaep_padding)  # type: ignore[union-attr]

            tar_buffer = io.BytesIO()
            with tarfile.open(fileobj=tar_buffer, mode="w") as tar:
                json_info = tarfile.TarInfo("export.json")
                json_info.size = len(encrypted_json_export)
                tar.addfile(json_info, fileobj=io.BytesIO(encrypted_json_export))
                key_info = tarfile.TarInfo("data.key")
                key_info.size = len(encrypted_dek)
                tar.addfile(key_info, fileobj=io.BytesIO(encrypted_dek))
                pub_info = tarfile.TarInfo("key.pub")
                pub_info.size = len(pem)
                tar.addfile(pub_info, fileobj=io.BytesIO(pem))

            i.write(tar_buffer.getvalue())

        return (tmp_tarball_path, tmp_priv_key_path)

    def test_user_import_decryption(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            (tmp_tarball_path, tmp_priv_key_path) = self.encrypt_json_fixture(tmp_dir)
            with assume_test_silo_mode(SiloMode.CONTROL):
                assert User.objects.count() == 0

            with (
                open(tmp_tarball_path, "rb") as tmp_tarball_file,
                open(tmp_priv_key_path, "rb") as tmp_priv_key_file,
            ):
                import_in_user_scope(
                    tmp_tarball_file,
                    decryptor=LocalFileDecryptor(tmp_priv_key_file),
                    printer=NOOP_PRINTER,
                )

            with assume_test_silo_mode(SiloMode.CONTROL):
                assert User.objects.count() > 0

    def test_organization_import_decryption(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            (tmp_tarball_path, tmp_priv_key_path) = self.encrypt_json_fixture(tmp_dir)
            assert Organization.objects.count() == 0

            with (
                open(tmp_tarball_path, "rb") as tmp_tarball_file,
                open(tmp_priv_key_path, "rb") as tmp_priv_key_file,
            ):
                import_in_organization_scope(
                    tmp_tarball_file,
                    decryptor=LocalFileDecryptor(tmp_priv_key_file),
                    printer=NOOP_PRINTER,
                )

            assert Organization.objects.count() > 0

    def test_config_import_decryption(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            (tmp_tarball_path, tmp_priv_key_path) = self.encrypt_json_fixture(tmp_dir)
            with assume_test_silo_mode(SiloMode.CONTROL):
                assert UserRole.objects.count() == 0

            with (
                open(tmp_tarball_path, "rb") as tmp_tarball_file,
                open(tmp_priv_key_path, "rb") as tmp_priv_key_file,
            ):
                import_in_config_scope(
                    tmp_tarball_file,
                    decryptor=LocalFileDecryptor(tmp_priv_key_file),
                    printer=NOOP_PRINTER,
                )

            with assume_test_silo_mode(SiloMode.CONTROL):
                assert UserRole.objects.count() > 0

    def test_global_import_decryption(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            (tmp_tarball_path, tmp_priv_key_path) = self.encrypt_json_fixture(tmp_dir)
            assert Organization.objects.count() == 0

            with assume_test_silo_mode(SiloMode.CONTROL):
                assert User.objects.count() == 0
                assert UserRole.objects.count() == 0

            with (
                open(tmp_tarball_path, "rb") as tmp_tarball_file,
                open(tmp_priv_key_path, "rb") as tmp_priv_key_file,
            ):
                import_in_global_scope(
                    tmp_tarball_file,
                    decryptor=LocalFileDecryptor(tmp_priv_key_file),
                    printer=NOOP_PRINTER,
                )

            assert Organization.objects.count() > 0

            with assume_test_silo_mode(SiloMode.CONTROL):
                assert User.objects.count() > 0
                assert UserRole.objects.count() > 0


# Filters should work identically in both silo and monolith modes, so no need to repeat the tests
# here.
class FilterTests(ImportTestCase):
    """
    Ensures that filtering operations include the correct models.
    """

    def test_import_filter_users(self):
        self.create_exhaustive_user("user_1")
        self.create_exhaustive_user("user_2")

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path, "rb") as tmp_file:
                import_in_user_scope(tmp_file, user_filter={"user_2"}, printer=NOOP_PRINTER)

        with assume_test_silo_mode(SiloMode.CONTROL):
            # Count users, but also count a random model naively derived from just `User` alone,
            # like `UserEmail`. Because `Email` and `UserEmail` have some automagic going on that
            # causes them to be created when a `User` is, we explicitly check to ensure that they
            # are behaving correctly as well.
            assert User.objects.count() == 1
            assert UserEmail.objects.count() == 1
            assert Email.objects.count() == 1

            assert (
                ControlImportChunk.objects.filter(
                    model="sentry.user", min_ordinal=1, max_ordinal=1
                ).count()
                == 1
            )
            assert (
                ControlImportChunk.objects.filter(
                    model="sentry.useremail", min_ordinal=1, max_ordinal=1
                ).count()
                == 1
            )
            assert (
                ControlImportChunk.objects.filter(
                    model="sentry.email", min_ordinal=1, max_ordinal=1
                ).count()
                == 1
            )

            assert not User.objects.filter(username="user_1").exists()
            assert User.objects.filter(username="user_2").exists()

    def test_import_filter_users_shared_email(self):
        self.create_exhaustive_user("user_1", email="a@example.com")
        self.create_exhaustive_user("user_2", email="b@example.com")
        self.create_exhaustive_user("user_3", email="a@example.com")
        self.create_exhaustive_user("user_4", email="b@example.com")

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path, "rb") as tmp_file:
                import_in_user_scope(
                    tmp_file, user_filter={"user_1", "user_2", "user_3"}, printer=NOOP_PRINTER
                )

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert User.objects.count() == 3
            assert UserEmail.objects.count() == 3
            assert Email.objects.count() == 2  # Lower due to shared emails

            assert (
                ControlImportChunk.objects.filter(
                    model="sentry.user", min_ordinal=1, max_ordinal=3
                ).count()
                == 1
            )
            assert (
                ControlImportChunk.objects.filter(
                    model="sentry.useremail", min_ordinal=1, max_ordinal=3
                ).count()
                == 1
            )
            assert (
                ControlImportChunk.objects.filter(
                    model="sentry.email", min_ordinal=1, max_ordinal=2
                ).count()
                == 1
            )

            assert User.objects.filter(username="user_1").exists()
            assert User.objects.filter(username="user_2").exists()
            assert User.objects.filter(username="user_3").exists()
            assert not User.objects.filter(username="user_4").exists()

    def test_import_filter_users_empty(self):
        self.create_exhaustive_user("user_1")
        self.create_exhaustive_user("user_2")

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path, "rb") as tmp_file:
                import_in_user_scope(tmp_file, user_filter=set(), printer=NOOP_PRINTER)

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert User.objects.count() == 0
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
            with open(tmp_path, "rb") as tmp_file:
                import_in_organization_scope(tmp_file, org_filter={"org-b"}, printer=NOOP_PRINTER)

        assert Organization.objects.count() == 1
        assert (
            RegionImportChunk.objects.filter(
                model="sentry.organization", min_ordinal=1, max_ordinal=1
            ).count()
            == 1
        )

        assert not Organization.objects.filter(slug="org-a").exists()
        assert Organization.objects.filter(slug="org-b").exists()
        assert not Organization.objects.filter(slug="org-c").exists()

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert OrgAuthToken.objects.count() == 1

            assert User.objects.count() == 4
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
            with open(tmp_path, "rb") as tmp_file:
                import_in_organization_scope(
                    tmp_file, org_filter={"org-a", "org-c"}, printer=NOOP_PRINTER
                )

        assert Organization.objects.count() == 2
        assert (
            RegionImportChunk.objects.filter(
                model="sentry.organization", min_ordinal=1, max_ordinal=2
            ).count()
            == 1
        )

        assert Organization.objects.filter(slug="org-a").exists()
        assert not Organization.objects.filter(slug="org-b").exists()
        assert Organization.objects.filter(slug="org-c").exists()

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert OrgAuthToken.objects.count() == 2
            assert (
                ControlImportChunk.objects.filter(
                    model="sentry.orgauthtoken", min_ordinal=1, max_ordinal=2
                ).count()
                == 1
            )

            assert User.objects.count() == 5
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
            with open(tmp_path, "rb") as tmp_file:
                import_in_organization_scope(tmp_file, org_filter=set(), printer=NOOP_PRINTER)

        assert Organization.objects.count() == 0

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert OrgAuthToken.objects.count() == 0

            assert User.objects.count() == 0
            assert UserEmail.objects.count() == 0
            assert Email.objects.count() == 0


COLLISION_TESTED: set[NormalizedModelName] = set()


class CollisionTests(ImportTestCase):
    """
    Ensure that collisions are properly handled in different flag modes.
    """

    @expect_models(COLLISION_TESTED, ApiToken)
    def test_colliding_api_token(self, expected_models: list[type[Model]]):
        owner = self.create_exhaustive_user("owner")
        expires_at = timezone.now() + DEFAULT_EXPIRATION

        # Take note of the `ApiTokens` that were created by the exhaustive organization - this is
        # the one we'll be importing.
        with assume_test_silo_mode(SiloMode.CONTROL):
            colliding_no_refresh_set = ApiToken.objects.create(user=owner, token=generate_token())
            colliding_no_refresh_set.refresh_token = None
            colliding_no_refresh_set.expires_at = None
            colliding_no_refresh_set.save()

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
            with assume_test_silo_mode(SiloMode.CONTROL):
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
                assert (
                    ApiToken.objects.filter(
                        token=colliding_no_refresh_set.token,
                        refresh_token__isnull=True,
                        expires_at__isnull=True,
                    ).count()
                    == 1
                )
                assert (
                    ApiToken.objects.filter(
                        refresh_token=colliding_same_refresh_only.refresh_token
                    ).count()
                    == 1
                )
                assert ApiToken.objects.filter(token=colliding_same_token_only.token).count() == 1
                assert (
                    ApiToken.objects.filter(
                        token=colliding_same_both.token,
                        refresh_token=colliding_same_both.refresh_token,
                    ).count()
                    == 1
                )

            with open(tmp_path, "rb") as tmp_file:
                import_in_config_scope(tmp_file, printer=NOOP_PRINTER)

            # Ensure that old tokens have not been mutated.
            with assume_test_silo_mode(SiloMode.CONTROL):
                assert ApiToken.objects.count() == 8
                assert (
                    ApiToken.objects.filter(
                        token=colliding_no_refresh_set.token,
                        refresh_token__isnull=True,
                        expires_at__isnull=True,
                    ).count()
                    == 1
                )
                assert (
                    ApiToken.objects.filter(
                        refresh_token=colliding_same_refresh_only.refresh_token
                    ).count()
                    == 1
                )
                assert ApiToken.objects.filter(token=colliding_same_token_only.token).count() == 1
                assert (
                    ApiToken.objects.filter(
                        token=colliding_same_both.token,
                        refresh_token=colliding_same_both.refresh_token,
                    ).count()
                    == 1
                )

                # Ensure newly added entries with nulled `refresh_token` and/or `expires_at` have
                # kept those fields nulled.
                assert (
                    ApiToken.objects.filter(
                        refresh_token__isnull=True,
                        expires_at__isnull=True,
                    ).count()
                    == 2
                )

            with open(tmp_path, "rb") as tmp_file:
                verify_models_in_output(expected_models, orjson.loads(tmp_file.read()))

    @expect_models(COLLISION_TESTED, Monitor)
    def test_colliding_monitor(self, expected_models: list[type[Model]]):
        owner = self.create_exhaustive_user("owner")
        invited = self.create_exhaustive_user("invited")
        self.create_exhaustive_organization("some-org", owner, invited)

        # Take note of a `Monitor` that was created by the exhaustive organization - this is the
        # one we'll be importing.
        colliding = Monitor.objects.get()

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)

            # After exporting and clearing the database, insert a copy of the same `Monitor` as
            # the one found in the import.
            colliding.organization_id = self.create_organization().id
            colliding.project_id = self.create_project().id
            colliding.save()

            assert Monitor.objects.count() == 1
            assert Monitor.objects.filter(guid=colliding.guid).count() == 1

            with open(tmp_path, "rb") as tmp_file:
                import_in_organization_scope(tmp_file, printer=NOOP_PRINTER)

            assert Monitor.objects.count() == 2
            assert Monitor.objects.filter(guid=colliding.guid).count() == 1

            with open(tmp_path, "rb") as tmp_file:
                verify_models_in_output(expected_models, orjson.loads(tmp_file.read()))

    @expect_models(COLLISION_TESTED, OrgAuthToken)
    def test_colliding_org_auth_token(self, expected_models: list[type[Model]]):
        owner = self.create_exhaustive_user("owner")
        invited = self.create_exhaustive_user("invited")
        member = self.create_exhaustive_user("member")
        self.create_exhaustive_organization("some-org", owner, invited, [member])

        # Take note of the `OrgAuthToken` that was created by the exhaustive organization - this is
        # the one we'll be importing.
        with assume_test_silo_mode(SiloMode.CONTROL):
            colliding = OrgAuthToken.objects.get()

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)

            # After exporting and clearing the database, insert a copy of the same `OrgAuthToken` as
            # the one found in the import.
            new_user = self.create_user("new")
            org = self.create_organization()

            with assume_test_silo_mode(SiloMode.CONTROL):
                colliding.created_by = new_user
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

            with open(tmp_path, "rb") as tmp_file:
                import_in_organization_scope(tmp_file, printer=NOOP_PRINTER)

            with assume_test_silo_mode(SiloMode.CONTROL):
                assert OrgAuthToken.objects.count() == 2
                assert OrgAuthToken.objects.filter(token_hashed=colliding.token_hashed).count() == 1
                assert (
                    OrgAuthToken.objects.filter(
                        token_last_characters=colliding.token_last_characters
                    ).count()
                    == 1
                )

            with open(tmp_path, "rb") as tmp_file:
                verify_models_in_output(expected_models, orjson.loads(tmp_file.read()))

    @expect_models(COLLISION_TESTED, ProjectKey)
    def test_colliding_project_key(self, expected_models: list[type[Model]]):
        owner = self.create_exhaustive_user("owner")
        invited = self.create_exhaustive_user("invited")
        member = self.create_exhaustive_user("member")
        self.create_exhaustive_organization("some-org", owner, invited, [member])

        # Take note of a `ProjectKey` that was created by the exhaustive organization - this is the
        # one we'll be importing.
        colliding = ProjectKey.objects.all()[0]

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)

            # After exporting and clearing the database, insert a copy of the same `ProjectKey` as
            # the one found in the import.
            colliding.project = self.create_project()
            colliding.save()

            assert ProjectKey.objects.count() < 4
            assert ProjectKey.objects.filter(public_key=colliding.public_key).count() == 1
            assert ProjectKey.objects.filter(secret_key=colliding.secret_key).count() == 1

            with open(tmp_path, "rb") as tmp_file:
                import_in_organization_scope(tmp_file, printer=NOOP_PRINTER)

            assert ProjectKey.objects.count() == 3
            assert ProjectKey.objects.filter(public_key=colliding.public_key).count() == 1
            assert ProjectKey.objects.filter(secret_key=colliding.secret_key).count() == 1

            with open(tmp_path, "rb") as tmp_file:
                verify_models_in_output(expected_models, orjson.loads(tmp_file.read()))

    @pytest.mark.xfail(
        not use_split_dbs(),
        reason="Preexisting failure: getsentry/team-ospo#206",
        raises=urllib3.exceptions.MaxRetryError,
        strict=True,
    )
    @expect_models(COLLISION_TESTED, QuerySubscription)
    def test_colliding_query_subscription(self, expected_models: list[type[Model]]):
        # We need a celery task running to properly test the `subscription_id` assignment, otherwise
        # its value just defaults to `None`.
        with self.tasks():
            owner = self.create_exhaustive_user("owner")
            invited = self.create_exhaustive_user("invited")
            member = self.create_exhaustive_user("member")
            self.create_exhaustive_organization("some-org", owner, invited, [member])

            # Take note of the `QuerySubscription` that was created by the exhaustive organization -
            # this is the one we'll be importing.
            colliding_snuba_query = SnubaQuery.objects.all()[0]
            colliding_query_subscription = QuerySubscription.objects.get(
                snuba_query=colliding_snuba_query
            )

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

                with open(tmp_path, "rb") as tmp_file:
                    import_in_organization_scope(tmp_file, printer=NOOP_PRINTER)

                assert SnubaQuery.objects.count() > 1
                assert QuerySubscription.objects.count() > 1
                assert (
                    QuerySubscription.objects.filter(
                        subscription_id=colliding_query_subscription.subscription_id
                    ).count()
                    == 1
                )

                with open(tmp_path, "rb") as tmp_file:
                    verify_models_in_output(expected_models, orjson.loads(tmp_file.read()))

    @expect_models(COLLISION_TESTED, SavedSearch)
    def test_colliding_saved_search(self, expected_models: list[type[Model]]):
        self.create_organization("some-org", owner=self.user)
        SavedSearch.objects.create(
            name="Global Search",
            query="saved query",
            is_global=True,
            visibility=Visibility.ORGANIZATION,
        )
        assert SavedSearch.objects.count() == 1

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            assert SavedSearch.objects.count() == 0

            # Allow `is_global` searches for `ImportScope.Global` imports.
            with open(tmp_path, "rb") as tmp_file:
                import_in_global_scope(tmp_file, printer=NOOP_PRINTER)

            assert SavedSearch.objects.count() == 1

            # Disallow `is_global` searches for `ImportScope.Organization` imports.
            with open(tmp_path, "rb") as tmp_file:
                import_in_organization_scope(tmp_file, printer=NOOP_PRINTER)

            assert SavedSearch.objects.count() == 1

            with open(tmp_path, "rb") as tmp_file:
                verify_models_in_output(expected_models, orjson.loads(tmp_file.read()))

    @expect_models(COLLISION_TESTED, ControlOption, Option, Relay, RelayUsage, UserRole)
    def test_colliding_configs_overwrite_configs_enabled_in_config_scope(
        self, expected_models: list[type[Model]]
    ):
        owner = self.create_exhaustive_user("owner", is_admin=True)
        self.create_exhaustive_global_configs(owner)

        # Take note of the configs we want to track - this is the one we'll be importing.
        colliding_option = Option.objects.get()
        colliding_relay = Relay.objects.get()
        colliding_relay_usage = RelayUsage.objects.get()

        old_relay_public_key = colliding_relay.public_key
        old_relay_usage_public_key = colliding_relay_usage.public_key

        with assume_test_silo_mode(SiloMode.CONTROL):
            colliding_control_option = ControlOption.objects.get()
            colliding_user_role = UserRole.objects.get()
            old_user_role_permissions = colliding_user_role.permissions

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)

            colliding_option.value = "y"
            colliding_option.save()

            colliding_relay.public_key = "invalid"
            colliding_relay.save()

            colliding_relay_usage.public_key = "invalid"
            colliding_relay_usage.save()

            assert Option.objects.count() == 1
            assert Relay.objects.count() == 1
            assert RelayUsage.objects.count() == 1

            with assume_test_silo_mode(SiloMode.CONTROL):
                colliding_control_option.value = "z"
                colliding_control_option.save()

                colliding_user_role.permissions = ["other.admin"]
                colliding_user_role.save()

                assert ControlOption.objects.count() == 1
                assert UserRole.objects.count() == 1

            with open(tmp_path, "rb") as tmp_file:
                import_in_config_scope(
                    tmp_file, flags=ImportFlags(overwrite_configs=True), printer=NOOP_PRINTER
                )

            option_chunk = RegionImportChunk.objects.get(
                model="sentry.option", min_ordinal=1, max_ordinal=1
            )
            assert len(option_chunk.inserted_map) == 0
            assert len(option_chunk.existing_map) == 0
            assert len(option_chunk.overwrite_map) == 1
            assert Option.objects.count() == 1
            assert Option.objects.filter(value__exact="a").exists()

            relay_chunk = RegionImportChunk.objects.get(
                model="sentry.relay", min_ordinal=1, max_ordinal=1
            )
            assert len(relay_chunk.inserted_map) == 0
            assert len(relay_chunk.existing_map) == 0
            assert len(relay_chunk.overwrite_map) == 1
            assert Relay.objects.count() == 1
            assert Relay.objects.filter(public_key__exact=old_relay_public_key).exists()

            relay_usage_chunk = RegionImportChunk.objects.get(
                model="sentry.relayusage", min_ordinal=1, max_ordinal=1
            )
            assert len(relay_usage_chunk.inserted_map) == 0
            assert len(relay_usage_chunk.existing_map) == 0
            assert len(relay_usage_chunk.overwrite_map) == 1
            assert RelayUsage.objects.count() == 1
            assert RelayUsage.objects.filter(public_key__exact=old_relay_usage_public_key).exists()

            with assume_test_silo_mode(SiloMode.CONTROL):
                control_option_chunk = ControlImportChunk.objects.get(
                    model="sentry.controloption", min_ordinal=1, max_ordinal=1
                )
                assert len(control_option_chunk.inserted_map) == 0
                assert len(control_option_chunk.existing_map) == 0
                assert len(control_option_chunk.overwrite_map) == 1
                assert ControlOption.objects.count() == 1
                assert ControlOption.objects.filter(value__exact="b").exists()

                actual_user_role = UserRole.objects.get()
                assert len(actual_user_role.permissions) == len(old_user_role_permissions)
                for i, actual_permission in enumerate(actual_user_role.permissions):
                    assert actual_permission == old_user_role_permissions[i]

            with open(tmp_path, "rb") as tmp_file:
                verify_models_in_output(expected_models, orjson.loads(tmp_file.read()))

    @expect_models(COLLISION_TESTED, ControlOption, Option, Relay, RelayUsage, UserRole)
    def test_colliding_configs_overwrite_configs_disabled_in_config_scope(
        self, expected_models: list[type[Model]]
    ):
        owner = self.create_exhaustive_user("owner", is_admin=True)
        self.create_exhaustive_global_configs(owner)

        # Take note of the configs we want to track - this is the one we'll be importing.
        colliding_option = Option.objects.get()
        colliding_relay = Relay.objects.get()
        colliding_relay_usage = RelayUsage.objects.get()

        with assume_test_silo_mode(SiloMode.CONTROL):
            colliding_control_option = ControlOption.objects.get()
            colliding_user_role = UserRole.objects.get()

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)

            colliding_option.value = "y"
            colliding_option.save()

            colliding_relay.public_key = "invalid"
            colliding_relay.save()

            colliding_relay_usage.public_key = "invalid"
            colliding_relay_usage.save()

            assert Option.objects.count() == 1
            assert Relay.objects.count() == 1
            assert RelayUsage.objects.count() == 1

            with assume_test_silo_mode(SiloMode.CONTROL):
                colliding_control_option.value = "z"
                colliding_control_option.save()

                colliding_user_role.permissions = ["other.admin"]
                colliding_user_role.save()

                assert ControlOption.objects.count() == 1
                assert UserRole.objects.count() == 1

            with open(tmp_path, "rb") as tmp_file:
                import_in_config_scope(
                    tmp_file, flags=ImportFlags(overwrite_configs=False), printer=NOOP_PRINTER
                )

            option_chunk = RegionImportChunk.objects.get(
                model="sentry.option", min_ordinal=1, max_ordinal=1
            )
            assert len(option_chunk.inserted_map) == 0
            assert len(option_chunk.existing_map) == 1
            assert len(option_chunk.overwrite_map) == 0
            assert Option.objects.count() == 1
            assert Option.objects.filter(value__exact="y").exists()

            relay_chunk = RegionImportChunk.objects.get(
                model="sentry.relay", min_ordinal=1, max_ordinal=1
            )
            assert len(relay_chunk.inserted_map) == 0
            assert len(relay_chunk.existing_map) == 1
            assert len(relay_chunk.overwrite_map) == 0
            assert Relay.objects.count() == 1
            assert Relay.objects.filter(public_key__exact="invalid").exists()

            relay_usage_chunk = RegionImportChunk.objects.get(
                model="sentry.relayusage", min_ordinal=1, max_ordinal=1
            )
            assert len(relay_usage_chunk.inserted_map) == 0
            assert len(relay_usage_chunk.existing_map) == 1
            assert len(relay_usage_chunk.overwrite_map) == 0
            assert RelayUsage.objects.count() == 1
            assert RelayUsage.objects.filter(public_key__exact="invalid").exists()

            with assume_test_silo_mode(SiloMode.CONTROL):
                control_option_chunk = ControlImportChunk.objects.get(
                    model="sentry.controloption", min_ordinal=1, max_ordinal=1
                )
                assert len(control_option_chunk.inserted_map) == 0
                assert len(control_option_chunk.existing_map) == 1
                assert len(control_option_chunk.overwrite_map) == 0
                assert ControlOption.objects.count() == 1
                assert ControlOption.objects.filter(value__exact="z").exists()

                assert UserRole.objects.count() == 1
                actual_user_role = UserRole.objects.get()
                assert len(actual_user_role.permissions) == 1
                assert actual_user_role.permissions[0] == "other.admin"

            with open(tmp_path, "rb") as tmp_file:
                verify_models_in_output(expected_models, orjson.loads(tmp_file.read()))

    @expect_models(COLLISION_TESTED, Email, User, UserEmail)
    def test_colliding_user_with_merging_enabled_in_user_scope(
        self, expected_models: list[type[Model]]
    ):
        self.create_exhaustive_user(username="owner", email="importing@example.com")

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path, "rb") as tmp_file:
                self.create_exhaustive_user(username="owner", email="existing@example.com")
                import_in_user_scope(
                    tmp_file,
                    flags=ImportFlags(merge_users=True),
                    printer=NOOP_PRINTER,
                )

            with assume_test_silo_mode(SiloMode.CONTROL):
                assert User.objects.count() == 1
                assert UserEmail.objects.count() == 1  # Keep only original when merging.
                assert Authenticator.objects.count() == 1
                assert Email.objects.count() == 2

                user_chunk = ControlImportChunk.objects.get(
                    model="sentry.user", min_ordinal=1, max_ordinal=1
                )
                assert len(user_chunk.inserted_map) == 0
                assert len(user_chunk.existing_map) == 1
                assert User.objects.filter(username__iexact="owner").exists()
                assert not User.objects.filter(username__iexact="owner-").exists()

                assert User.objects.filter(is_unclaimed=True).count() == 0
                assert LostPasswordHash.objects.count() == 0
                assert User.objects.filter(is_unclaimed=False).count() == 1
                assert UserEmail.objects.filter(email__icontains="existing@").exists()
                assert not UserEmail.objects.filter(email__icontains="importing@").exists()

                # Incoming `UserEmail`s and `UserPermissions` for imported users are completely
                # scrubbed when merging is enabled.
                assert not ControlImportChunk.objects.filter(model="sentry.useremail").exists()
                assert not ControlImportChunk.objects.filter(model="sentry.userpermission").exists()

            with open(tmp_path, "rb") as tmp_file:
                verify_models_in_output(expected_models, orjson.loads(tmp_file.read()))

    @expect_models(COLLISION_TESTED, Email, User, UserEmail)
    def test_colliding_user_with_merging_disabled_in_user_scope(
        self, expected_models: list[type[Model]]
    ):
        self.create_exhaustive_user(username="owner", email="importing@example.com")

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path, "rb") as tmp_file:
                self.create_exhaustive_user(username="owner", email="existing@example.com")
                import_in_user_scope(
                    tmp_file,
                    flags=ImportFlags(merge_users=False),
                    printer=NOOP_PRINTER,
                )

            with assume_test_silo_mode(SiloMode.CONTROL):
                assert User.objects.count() == 2
                assert UserEmail.objects.count() == 2
                assert Authenticator.objects.count() == 1  # Only imported in global scope
                assert Email.objects.count() == 2

                user_chunk = ControlImportChunk.objects.get(
                    model="sentry.user", min_ordinal=1, max_ordinal=1
                )
                assert len(user_chunk.inserted_map) == 1
                assert len(user_chunk.existing_map) == 0
                assert User.objects.filter(username__iexact="owner").exists()
                assert User.objects.filter(username__icontains="owner-").exists()

                assert User.objects.filter(is_unclaimed=True).count() == 1
                assert LostPasswordHash.objects.count() == 1
                assert User.objects.filter(is_unclaimed=False).count() == 1

                useremail_chunk = ControlImportChunk.objects.get(
                    model="sentry.useremail", min_ordinal=1, max_ordinal=1
                )
                assert len(useremail_chunk.inserted_map) == 1
                assert len(useremail_chunk.existing_map) == 0
                assert UserEmail.objects.filter(email__icontains="existing@").exists()
                assert UserEmail.objects.filter(email__icontains="importing@").exists()

            with open(tmp_path, "rb") as tmp_file:
                verify_models_in_output(expected_models, orjson.loads(tmp_file.read()))

    @expect_models(COLLISION_TESTED, Email, Organization, OrganizationMember, User, UserEmail)
    def test_colliding_user_with_merging_enabled_in_organization_scope(
        self, expected_models: list[type[Model]]
    ):
        owner = self.create_exhaustive_user(username="owner", email="importing@example.com")
        org = self.create_organization("some-org", owner=owner)
        old_org_membership = OrganizationMember.objects.get(organization=org)
        old_org_membership.regenerate_token()
        old_org_membership.save()

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path, "rb") as tmp_file:
                owner = self.create_exhaustive_user(username="owner", email="existing@example.com")
                org = self.create_organization("some-org", owner=owner)

                # Re-insert colliding tokens, pointed at the new user and org.
                new_org_membership = OrganizationMember.objects.get(organization=org)
                new_org_membership.token = old_org_membership.token
                new_org_membership.token_expires_at = old_org_membership.token_expires_at
                new_org_membership.save()

                import_in_organization_scope(
                    tmp_file,
                    flags=ImportFlags(merge_users=True),
                    printer=NOOP_PRINTER,
                )

            with assume_test_silo_mode(SiloMode.CONTROL):
                user = User.objects.get(username="owner")

                assert User.objects.count() == 1
                assert UserEmail.objects.count() == 1  # Keep only original when merging.
                assert Authenticator.objects.count() == 1  # Only imported in global scope
                assert Email.objects.count() == 2

                user_chunk = ControlImportChunk.objects.get(
                    model="sentry.user", min_ordinal=1, max_ordinal=1
                )
                assert len(user_chunk.inserted_map) == 0
                assert len(user_chunk.existing_map) == 1
                assert User.objects.filter(username__iexact="owner").exists()
                assert not User.objects.filter(username__icontains="owner-").exists()

                assert User.objects.filter(is_unclaimed=True).count() == 0
                assert LostPasswordHash.objects.count() == 0
                assert User.objects.filter(is_unclaimed=False).count() == 1

                assert UserEmail.objects.filter(email__icontains="existing@").exists()
                assert not UserEmail.objects.filter(email__icontains="importing@").exists()

                # Incoming `UserEmail`s, and `UserPermissions` for imported users are completely
                # dropped when merging is enabled.
                assert not ControlImportChunk.objects.filter(model="sentry.useremail").exists()
                assert not ControlImportChunk.objects.filter(model="sentry.userpermission").exists()

            assert Organization.objects.count() == 2
            assert OrganizationMember.objects.count() == 2  # Same user in both orgs

            existing = Organization.objects.get(slug="some-org")
            imported = Organization.objects.filter(slug__icontains="some-org-").first()
            assert (
                OrganizationMember.objects.filter(user_id=user.id, organization=existing).count()
                == 1
            )
            assert (
                OrganizationMember.objects.filter(user_id=user.id, organization=imported).count()
                == 1
            )

            # Expect one of the tokens to be nulled out due to collision.
            assert OrganizationMember.objects.filter(token=old_org_membership.token).count() == 1
            assert OrganizationMember.objects.filter(token__isnull=True).count() == 1

            with assume_test_silo_mode(SiloMode.CONTROL):
                assert OrganizationMapping.objects.count() == 2
                assert OrganizationMemberMapping.objects.count() == 2  # Same user in both orgs
                assert (
                    OrganizationMemberMapping.objects.filter(
                        user=user, organization_id=existing.id
                    ).count()
                    == 1
                )

            with open(tmp_path, "rb") as tmp_file:
                verify_models_in_output(expected_models, orjson.loads(tmp_file.read()))

    @expect_models(COLLISION_TESTED, Email, Organization, OrganizationMember, User, UserEmail)
    def test_colliding_user_with_merging_disabled_in_organization_scope(
        self, expected_models: list[type[Model]]
    ):
        owner = self.create_exhaustive_user(username="owner", email="importing@example.com")
        org = self.create_organization("some-org", owner=owner)
        old_org_membership = OrganizationMember.objects.get(organization=org)
        old_org_membership.regenerate_token()
        old_org_membership.save()

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path, "rb") as tmp_file:
                owner = self.create_exhaustive_user(username="owner", email="existing@example.com")
                org = self.create_organization("some-org", owner=owner)

                # Re-insert colliding tokens, pointed at the new user and org.
                new_org_membership = OrganizationMember.objects.get(organization=org)
                new_org_membership.token = old_org_membership.token
                new_org_membership.token_expires_at = old_org_membership.token_expires_at
                new_org_membership.save()

                import_in_organization_scope(
                    tmp_file,
                    flags=ImportFlags(merge_users=False),
                    printer=NOOP_PRINTER,
                )

            with assume_test_silo_mode(SiloMode.CONTROL):
                existing_user = User.objects.get(username="owner")
                imported_user = User.objects.get(username__icontains="owner-")

                assert User.objects.count() == 2
                assert UserEmail.objects.count() == 2
                assert Authenticator.objects.count() == 1  # Only imported in global scope
                assert Email.objects.count() == 2

                user_chunk = ControlImportChunk.objects.get(
                    model="sentry.user", min_ordinal=1, max_ordinal=1
                )
                assert len(user_chunk.inserted_map) == 1
                assert len(user_chunk.existing_map) == 0
                assert User.objects.filter(username__iexact="owner").exists()
                assert User.objects.filter(username__icontains="owner-").exists()

                assert User.objects.filter(is_unclaimed=True).count() == 1
                assert LostPasswordHash.objects.count() == 1
                assert User.objects.filter(is_unclaimed=False).count() == 1

                useremail_chunk = ControlImportChunk.objects.get(
                    model="sentry.useremail", min_ordinal=1, max_ordinal=1
                )
                assert len(useremail_chunk.inserted_map) == 1
                assert len(useremail_chunk.existing_map) == 0
                assert UserEmail.objects.filter(email__icontains="existing@").exists()
                assert UserEmail.objects.filter(email__icontains="importing@").exists()

            assert Organization.objects.count() == 2
            assert OrganizationMember.objects.count() == 2

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

            # Expect one of the tokens to be nulled out due to collision.
            assert OrganizationMember.objects.filter(token=old_org_membership.token).count() == 1
            assert OrganizationMember.objects.filter(token__isnull=True).count() == 1

            with assume_test_silo_mode(SiloMode.CONTROL):
                assert OrganizationMapping.objects.count() == 2
                assert OrganizationMemberMapping.objects.count() == 2
                assert (
                    OrganizationMemberMapping.objects.filter(
                        user=existing_user, organization_id=existing_org.id
                    ).count()
                    == 1
                )

            with open(tmp_path, "rb") as tmp_file:
                verify_models_in_output(expected_models, orjson.loads(tmp_file.read()))

    @expect_models(COLLISION_TESTED, Email, User, UserEmail, UserPermission)
    def test_colliding_user_with_merging_enabled_in_config_scope(
        self, expected_models: list[type[Model]]
    ):
        self.create_exhaustive_user(username="owner", email="importing@example.com", is_admin=True)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path, "rb") as tmp_file:
                self.create_exhaustive_user(
                    username="owner", email="existing@example.com", is_admin=True
                )
                import_in_config_scope(
                    tmp_file,
                    flags=ImportFlags(merge_users=True),
                    printer=NOOP_PRINTER,
                )

            with assume_test_silo_mode(SiloMode.CONTROL):
                assert User.objects.count() == 1
                assert UserEmail.objects.count() == 1  # Keep only original when merging.
                assert UserPermission.objects.count() == 1  # Keep only original when merging.
                assert Authenticator.objects.count() == 1
                assert Email.objects.count() == 2

                user_chunk = ControlImportChunk.objects.get(
                    model="sentry.user", min_ordinal=1, max_ordinal=1
                )
                assert len(user_chunk.inserted_map) == 0
                assert len(user_chunk.existing_map) == 1
                assert User.objects.filter(username__iexact="owner").exists()
                assert not User.objects.filter(username__iexact="owner-").exists()

                assert User.objects.filter(is_unclaimed=True).count() == 0
                assert LostPasswordHash.objects.count() == 0
                assert User.objects.filter(is_unclaimed=False).count() == 1

                assert UserEmail.objects.filter(email__icontains="existing@").exists()
                assert not UserEmail.objects.filter(email__icontains="importing@").exists()

                # Incoming `UserEmail`s, and `UserPermissions` for imported users are completely
                # dropped when merging is enabled.
                assert not ControlImportChunk.objects.filter(model="sentry.useremail").exists()
                assert not ControlImportChunk.objects.filter(model="sentry.userpermission").exists()

            with open(tmp_path, "rb") as tmp_file:
                verify_models_in_output(expected_models, orjson.loads(tmp_file.read()))

    @expect_models(COLLISION_TESTED, Email, User, UserEmail, UserPermission)
    def test_colliding_user_with_merging_disabled_in_config_scope(
        self, expected_models: list[type[Model]]
    ):
        self.create_exhaustive_user(username="owner", email="importing@example.com", is_admin=True)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path, "rb") as tmp_file:
                self.create_exhaustive_user(
                    username="owner", email="existing@example.com", is_admin=True
                )
                import_in_config_scope(
                    tmp_file,
                    flags=ImportFlags(merge_users=False),
                    printer=NOOP_PRINTER,
                )

            with assume_test_silo_mode(SiloMode.CONTROL):
                assert User.objects.count() == 2
                assert UserEmail.objects.count() == 2
                assert UserPermission.objects.count() == 2
                assert Authenticator.objects.count() == 1  # Only imported in global scope
                assert Email.objects.count() == 2

                user_chunk = ControlImportChunk.objects.get(
                    model="sentry.user", min_ordinal=1, max_ordinal=1
                )
                assert len(user_chunk.inserted_map) == 1
                assert len(user_chunk.existing_map) == 0
                assert User.objects.filter(username__iexact="owner").exists()
                assert User.objects.filter(username__icontains="owner-").exists()

                assert User.objects.filter(is_unclaimed=True).count() == 1
                assert LostPasswordHash.objects.count() == 1
                assert User.objects.filter(is_unclaimed=False).count() == 1

                useremail_chunk = ControlImportChunk.objects.get(
                    model="sentry.useremail", min_ordinal=1, max_ordinal=1
                )
                assert len(useremail_chunk.inserted_map) == 1
                assert len(useremail_chunk.existing_map) == 0
                assert UserEmail.objects.filter(email__icontains="existing@").exists()
                assert UserEmail.objects.filter(email__icontains="importing@").exists()

            with open(tmp_path, "rb") as tmp_file:
                verify_models_in_output(expected_models, orjson.loads(tmp_file.read()))


CUSTOM_IMPORT_BEHAVIOR_TESTED: set[NormalizedModelName] = set()


# There is no need to in both monolith and region mode for model-level unit tests - region mode
# testing along should suffice.
class CustomImportBehaviorTests(ImportTestCase):
    """
    Test bespoke, per-model behavior. Since these tests are relatively expensive to set up and tear
    down (think on the order of 5-10 seconds per test case), we encourage combining model test cases
    as much as reasonably possible.
    """

    @expect_models(CUSTOM_IMPORT_BEHAVIOR_TESTED, OrganizationMember)
    def test_hide_organizations_import_flag(self, expected_models: list[type[Model]]):
        owner = self.create_exhaustive_user("owner", email="owner@test.com")
        member = self.create_exhaustive_user("member", email="member@test.com")
        self.create_exhaustive_organization(
            slug="test-org",
            owner=owner,
            member=member,
        )

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path, "rb") as tmp_file:
                import_in_organization_scope(
                    tmp_file,
                    org_filter={"test-org"},
                    flags=ImportFlags(hide_organizations=True),
                    printer=NOOP_PRINTER,
                )

            assert (
                Organization.objects.get(slug="test-org").status
                == OrganizationStatus.RELOCATION_PENDING_APPROVAL.value
            )

            with open(tmp_path, "rb") as tmp_file:
                verify_models_in_output(expected_models, orjson.loads(tmp_file.read()))

    @expect_models(CUSTOM_IMPORT_BEHAVIOR_TESTED, OrganizationMember)
    def test_organization_member_inviter_id(self, expected_models: list[type[Model]]):
        admin = self.create_exhaustive_user("admin", email="admin@test.com", is_superuser=True)
        owner = self.create_exhaustive_user("owner", email="owner@test.com")
        member = self.create_exhaustive_user("member", email="member@test.com")
        org = self.create_exhaustive_organization(
            slug="test-org",
            owner=owner,
            member=member,
            pending_invites={
                admin: "invited-by-admin@test.com",
                owner: "invited-by-owner@test.com",
            },
        )

        # Give each member an inviter that is not in the organization itself (the "admin"), meaning
        # they will not be imported if we only filter down to `test-org`. The desired outcome is
        # that the inviter is nulled out.
        for org_member in OrganizationMember.objects.filter(organization=org):
            if not org_member.inviter_id:
                org_member.inviter_id = admin.id
                org_member.save()
        assert (
            OrganizationMember.objects.filter(organization=org.id, inviter_id__isnull=False).count()
            == 4
        )

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path, "rb") as tmp_file:
                import_in_organization_scope(
                    tmp_file,
                    org_filter={"test-org"},
                    printer=NOOP_PRINTER,
                )

            # `owner` and `member` should both have had their `inviter_id` scrubbed.
            org_id = Organization.objects.get(slug="test-org").id
            assert OrganizationMember.objects.filter(
                organization=org_id,
                user_email="owner@test.com",
                email__isnull=True,
                inviter_id__isnull=True,
            ).exists()
            assert OrganizationMember.objects.filter(
                organization=org_id,
                user_email="member@test.com",
                email__isnull=True,
                inviter_id__isnull=True,
            ).exists()

            # The invitee invited by the not-imported `admin` should lose their `inviter_id`, but
            # the one invited by `owner` should keep it.
            assert OrganizationMember.objects.filter(
                organization=org_id,
                email="invited-by-admin@test.com",
                inviter_id__isnull=True,
            ).exists()
            assert OrganizationMember.objects.filter(
                organization=org_id,
                email="invited-by-owner@test.com",
                inviter_id__isnull=False,
            ).exists()

            with open(tmp_path, "rb") as tmp_file:
                verify_models_in_output(expected_models, orjson.loads(tmp_file.read()))

    @expect_models(CUSTOM_IMPORT_BEHAVIOR_TESTED, Project)
    def test_project_ids_retained_in_global_scope(self, expected_models: list[type[Model]]):
        owner = self.create_user("testing@example.com")
        org = self.create_organization(name="Some Org", owner=owner)
        team = self.create_team(organization=org, name="Some Team")

        # Only the sparse ids of projects 2 and 4 remain.
        proj1 = self.create_project(organization=org, teams=[team], name="Project Foo")
        proj2 = self.create_project(organization=org, teams=[team], name="Project Bar")
        proj3 = self.create_project(organization=org, teams=[team], name="Project Baz")
        proj4 = self.create_project(organization=org, teams=[team], name="Project Qux")
        proj1.delete()
        proj3.delete()
        existing_proj_ids = [proj2.pk, proj4.pk]

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path, "rb") as tmp_file:
                import_in_global_scope(
                    tmp_file,
                    printer=NOOP_PRINTER,
                )

            imported_proj_ids = list(Project.objects.all().values_list("id", flat=True))

            # Original IDs are retained, to preserve DSNs after a global import.
            assert set(imported_proj_ids) == set(existing_proj_ids)

            with open(tmp_path, "rb") as tmp_file:
                verify_models_in_output(expected_models, orjson.loads(tmp_file.read()))

    @expect_models(CUSTOM_IMPORT_BEHAVIOR_TESTED, Project)
    def test_project_ids_reassigned_in_organization_scope(self, expected_models: list[type[Model]]):
        owner = self.create_user("testing@example.com")
        org = self.create_organization(name="Some Org", owner=owner)
        team = self.create_team(organization=org, name="Some Team")

        # Only the sparse ids of projects 2 and 4 remain.
        proj1 = self.create_project(organization=org, teams=[team], name="Project Foo")
        proj2 = self.create_project(organization=org, teams=[team], name="Project Bar")
        proj3 = self.create_project(organization=org, teams=[team], name="Project Baz")
        proj4 = self.create_project(organization=org, teams=[team], name="Project Qux")
        proj1.delete()
        proj3.delete()
        existing_proj_ids = [proj2.pk, proj4.pk]

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = self.export_to_tmp_file_and_clear_database(tmp_dir)
            with open(tmp_path, "rb") as tmp_file:
                import_in_organization_scope(
                    tmp_file,
                    printer=NOOP_PRINTER,
                )

            imported_proj_ids = list(Project.objects.all().values_list("id", flat=True))

            # IDs are re-assigned in non-global import scopes.
            assert set(imported_proj_ids).isdisjoint(set(existing_proj_ids))

            with open(tmp_path, "rb") as tmp_file:
                verify_models_in_output(expected_models, orjson.loads(tmp_file.read()))


class BatchingTests(TestCase):
    """
    Ensure large lists of a single model type are batched properly, and that this batching does not disrupt pk mapping. These tests do not inherit from `ImportTestCase` because they do not require a completely clean database.
    """

    def import_n_users_with_options(self, import_uuid: str, n: int) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            with open(tmp_path, "wb") as tmp_file:
                users = []
                user_options = []
                for i in range(1, n + 1):
                    users.append(
                        {
                            "model": "sentry.user",
                            "pk": i + 100,
                            "fields": {
                                "password": "fake",
                                "username": f"user-{i}",
                                "name": f"user-{i}",
                                "email": f"{i}@example.com",
                                "is_staff": False,
                                "is_active": True,
                                "is_superuser": False,
                                "is_managed": False,
                                "is_password_expired": False,
                                "is_unclaimed": False,
                                "last_password_change": "2023-06-22T22:59:57.023Z",
                                "flags": "0",
                                "date_joined": "2023-06-22T22:59:55.488Z",
                                "last_active": "2023-06-22T22:59:55.489Z",
                                "avatar_type": 0,
                            },
                        }
                    )
                    user_options.append(
                        {
                            "model": "sentry.useroption",
                            "pk": i + 1000,
                            "fields": {
                                "user": i + 100,
                                "key": f"key-{i}",
                                "value": f"user-{i}",
                            },
                        }
                    )

                tmp_file.write(orjson.dumps(users + user_options))

            with open(tmp_path, "rb") as tmp_file:
                import_in_user_scope(
                    tmp_file, flags=ImportFlags(import_uuid=import_uuid), printer=NOOP_PRINTER
                )

    def test_exact_multiple_of_batch_size(self):
        import_uuid = uuid4().hex
        want_chunks = 2
        n = MAX_BATCH_SIZE * want_chunks
        self.import_n_users_with_options(import_uuid, n)

        with assume_test_silo_mode(SiloMode.CONTROL):
            user_chunks = list(
                ControlImportChunk.objects.filter(import_uuid=import_uuid, model="sentry.user")
            )
            user_option_chunks = list(
                ControlImportChunk.objects.filter(
                    import_uuid=import_uuid, model="sentry.useroption"
                )
            )

            assert len(user_chunks) == want_chunks
            assert len(user_option_chunks) == want_chunks

            assert user_chunks[0].min_ordinal == 1
            assert user_chunks[0].max_ordinal == MAX_BATCH_SIZE
            assert user_chunks[0].min_source_pk == 101
            assert user_chunks[0].max_source_pk == MAX_BATCH_SIZE + 100

            assert user_chunks[1].min_ordinal == MAX_BATCH_SIZE + 1
            assert user_chunks[1].max_ordinal == MAX_BATCH_SIZE * 2
            assert user_chunks[1].min_source_pk == MAX_BATCH_SIZE + 101
            assert user_chunks[1].max_source_pk == (MAX_BATCH_SIZE * 2) + 100

            assert user_option_chunks[0].min_ordinal == 1
            assert user_option_chunks[0].max_ordinal == MAX_BATCH_SIZE
            assert user_option_chunks[0].min_source_pk == 1001
            assert user_option_chunks[0].max_source_pk == MAX_BATCH_SIZE + 1000

            assert user_option_chunks[1].min_ordinal == MAX_BATCH_SIZE + 1
            assert user_option_chunks[1].max_ordinal == MAX_BATCH_SIZE * 2
            assert user_option_chunks[1].min_source_pk == MAX_BATCH_SIZE + 1001
            assert user_option_chunks[1].max_source_pk == (MAX_BATCH_SIZE * 2) + 1000

            # Ensure pk mapping from a later batch is still consistent.
            target = MAX_BATCH_SIZE + (MAX_BATCH_SIZE // 2)
            user_option = UserOption.objects.get(key=f"key-{target}")
            user = User.objects.get(id=user_option.user_id)
            assert user.name == f"user-{target}"

    def test_one_more_than_batch_size(self):
        import_uuid = uuid4().hex
        want_chunks = 2
        n = MAX_BATCH_SIZE + 1
        self.import_n_users_with_options(import_uuid, n)

        with assume_test_silo_mode(SiloMode.CONTROL):
            user_chunks = list(
                ControlImportChunk.objects.filter(import_uuid=import_uuid, model="sentry.user")
            )
            user_option_chunks = list(
                ControlImportChunk.objects.filter(
                    import_uuid=import_uuid, model="sentry.useroption"
                )
            )

            assert len(user_chunks) == want_chunks
            assert len(user_option_chunks) == want_chunks

            assert user_chunks[0].min_ordinal == 1
            assert user_chunks[0].max_ordinal == MAX_BATCH_SIZE
            assert user_chunks[0].min_source_pk == 101
            assert user_chunks[0].max_source_pk == MAX_BATCH_SIZE + 100

            assert user_chunks[1].min_ordinal == MAX_BATCH_SIZE + 1
            assert user_chunks[1].max_ordinal == MAX_BATCH_SIZE + 1
            assert user_chunks[1].min_source_pk == MAX_BATCH_SIZE + 101
            assert user_chunks[1].max_source_pk == MAX_BATCH_SIZE + 101

            assert user_option_chunks[0].min_ordinal == 1
            assert user_option_chunks[0].max_ordinal == MAX_BATCH_SIZE
            assert user_option_chunks[0].min_source_pk == 1001
            assert user_option_chunks[0].max_source_pk == MAX_BATCH_SIZE + 1000

            assert user_option_chunks[1].min_ordinal == MAX_BATCH_SIZE + 1
            assert user_option_chunks[1].max_ordinal == MAX_BATCH_SIZE + 1
            assert user_option_chunks[1].min_source_pk == MAX_BATCH_SIZE + 1001
            assert user_option_chunks[1].max_source_pk == MAX_BATCH_SIZE + 1001

            # Ensure pk mapping from a later batch is still consistent.
            target = MAX_BATCH_SIZE + 1
            user_option = UserOption.objects.get(key=f"key-{target}")
            user = User.objects.get(id=user_option.user_id)
            assert user.name == f"user-{target}"


@pytest.mark.skipif(reason="not legacy")
class TestLegacyTestSuite:
    def test_deleteme(self):
        """
        The monolith-dbs test suite should only exist until relocation code
        handles monolith- and hybrid-database modes with the same code path,
        which is planned work.
        """
        assert date.today() <= date(
            2023, 11, 11
        ), "Please delete the monolith-dbs test suite!"  # or else bump the date
