from __future__ import annotations

from copy import deepcopy
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

from orjson import JSONDecodeError, dumps

from sentry.backup.crypto import (
    DecryptionError,
    EncryptorDecryptorPair,
    LocalFileDecryptor,
    LocalFileEncryptor,
    create_encrypted_export_tarball,
    decrypt_encrypted_tarball,
)
from sentry.backup.dependencies import NormalizedModelName, get_model, get_model_name
from sentry.backup.exports import ExportCheckpointer, ExportCheckpointerError
from sentry.backup.helpers import Printer
from sentry.backup.scopes import ExportScope
from sentry.backup.services.import_export.model import RpcExportOk
from sentry.db import models
from sentry.models.options.option import Option
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.testutils.helpers.backups import (
    NOOP_PRINTER,
    BackupTransactionTestCase,
    export_to_encrypted_tarball,
    export_to_file,
    generate_rsa_key_pair,
)
from sentry.testutils.helpers.datetime import freeze_time
from sentry.users.models.email import Email
from sentry.users.models.user import User
from sentry.users.models.useremail import UserEmail
from sentry.users.models.userpermission import UserPermission
from sentry.users.models.userrole import UserRole, UserRoleUser
from tests.sentry.backup import get_matching_exportable_models


class FakeExportCheckpointer(ExportCheckpointer):
    cache_hits: int = 0
    cache_misses: int = 0
    cache_writes: int = 0

    def __init__(
        self,
        crypto: EncryptorDecryptorPair | None,
        printer: Printer,
        tmp_dir: str,
        test_method_name: str,
    ):
        self.__crypto = crypto
        self.__printer = printer
        self.__tmp_dir = tmp_dir
        self.__test_method_name = test_method_name

    def _get_file_name(self, model_name: NormalizedModelName) -> Path:
        if self.__crypto is None:
            return Path(self.__tmp_dir).joinpath(
                f"_{self.__test_method_name}.checkpoint.{str(model_name)}.json"
            )
        else:
            return Path(self.__tmp_dir).joinpath(
                f"_{self.__test_method_name}.checkpoint.{str(model_name)}.enc.tar"
            )

    def get(self, model_name: NormalizedModelName) -> RpcExportOk | None:
        file_name = self._get_file_name(model_name)
        try:
            with open(file_name, "rb") as fp:
                json_data = (
                    decrypt_encrypted_tarball(fp, self.__crypto.decryptor)
                    if self.__crypto is not None
                    else fp.read()
                )
                parsed_json = self._parse_cached_json(json_data)
                if parsed_json is None:
                    self.cache_misses += 1
                else:
                    self.cache_hits += 1

                return parsed_json
        except (FileNotFoundError, DecryptionError, JSONDecodeError, ExportCheckpointerError):
            self.cache_misses += 1
            return None

    def add(self, model_name: NormalizedModelName, json_export: Any) -> None:
        file_name = self._get_file_name(model_name)
        with open(file_name, "wb") as fp:
            out_bytes = (
                create_encrypted_export_tarball(json_export, self.__crypto.encryptor).getvalue()
                if self.__crypto is not None
                else dumps(json_export)
            )
            fp.write(out_bytes)
            self.cache_writes += 1


class ExportTestCase(BackupTransactionTestCase):
    @staticmethod
    def count(data: Any, model: type[models.base.BaseModel]) -> int:
        return len(list(filter(lambda d: d["model"] == str(get_model_name(model)), data)))

    @staticmethod
    def exists(
        data: Any, model: type[models.base.BaseModel], key: str, value: Any | None = None
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

    def export(
        self,
        tmp_dir: str,
        *,
        scope: ExportScope,
        filter_by: set[str] | None = None,
        checkpointer: ExportCheckpointer | None = None,
    ) -> Any:
        tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
        return export_to_file(tmp_path, scope=scope, filter_by=filter_by, checkpointer=checkpointer)

    def export_and_encrypt(
        self,
        tmp_dir: str,
        *,
        scope: ExportScope,
        rsa_key_pair: tuple[bytes, bytes],
        filter_by: set[str] | None = None,
        checkpointer: ExportCheckpointer | None = None,
    ) -> Any:
        tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.enc.tar")
        return export_to_encrypted_tarball(
            tmp_path,
            scope=scope,
            filter_by=filter_by,
            checkpointer=checkpointer,
            rsa_key_pair=rsa_key_pair,
        )


class ScopingTests(ExportTestCase):
    """
    Ensures that only models with the allowed relocation scopes are actually exported.
    """

    @staticmethod
    def verify_model_inclusion(data: Any, scope: ExportScope) -> None:
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

    @freeze_time("2023-10-11 18:00:00")
    def test_user_export_scoping(self):
        self.create_exhaustive_instance(is_superadmin=True)
        with TemporaryDirectory() as tmp_dir:
            unencrypted_checkpointer = FakeExportCheckpointer(
                crypto=None,
                printer=NOOP_PRINTER,
                tmp_dir=tmp_dir,
                test_method_name=self._testMethodName,
            )
            unencrypted = self.export(
                tmp_dir, scope=ExportScope.User, checkpointer=unencrypted_checkpointer
            )
            self.verify_model_inclusion(unencrypted, ExportScope.User)

            first_pass_cache_writes = unencrypted_checkpointer.cache_writes
            assert unencrypted_checkpointer.cache_hits == 0
            assert unencrypted_checkpointer.cache_misses > 0
            assert unencrypted_checkpointer.cache_misses == first_pass_cache_writes

            # The following re-run of `self.export` should only use the checkpoint cache. After
            # completion, we should have no new writes, and no new misses; only hits should be
            # incremented.
            self.export(tmp_dir, scope=ExportScope.User, checkpointer=unencrypted_checkpointer)
            assert unencrypted_checkpointer.cache_hits == first_pass_cache_writes
            assert unencrypted_checkpointer.cache_misses == first_pass_cache_writes
            assert unencrypted_checkpointer.cache_writes == first_pass_cache_writes

            rsa_key_pair = generate_rsa_key_pair()
            (private_key_pem, public_key_pem) = rsa_key_pair
            encrypted_checkpointer = FakeExportCheckpointer(
                crypto=EncryptorDecryptorPair(
                    encryptor=LocalFileEncryptor(BytesIO(public_key_pem)),
                    decryptor=LocalFileDecryptor(BytesIO(private_key_pem)),
                ),
                printer=NOOP_PRINTER,
                tmp_dir=tmp_dir,
                test_method_name=self._testMethodName,
            )
            encrypted = self.export_and_encrypt(
                tmp_dir,
                scope=ExportScope.User,
                rsa_key_pair=rsa_key_pair,
                checkpointer=encrypted_checkpointer,
            )
            assert unencrypted == encrypted

            assert encrypted_checkpointer.cache_hits == 0
            assert encrypted_checkpointer.cache_misses == first_pass_cache_writes
            assert encrypted_checkpointer.cache_writes == first_pass_cache_writes

            # The following re-run of `self.export_and_encrypt` should only use the checkpoint
            # cache. After completion, we should have no new writes, and no new misses; only hits
            # should be incremented.
            self.export_and_encrypt(
                tmp_dir,
                scope=ExportScope.User,
                rsa_key_pair=rsa_key_pair,
                checkpointer=encrypted_checkpointer,
            )
            assert encrypted_checkpointer.cache_hits == first_pass_cache_writes
            assert encrypted_checkpointer.cache_misses == first_pass_cache_writes
            assert encrypted_checkpointer.cache_writes == first_pass_cache_writes

    @freeze_time("2023-10-11 18:00:00")
    def test_organization_export_scoping(self):
        self.create_exhaustive_instance(is_superadmin=True)
        with TemporaryDirectory() as tmp_dir:
            unencrypted_checkpointer = FakeExportCheckpointer(
                crypto=None,
                printer=NOOP_PRINTER,
                tmp_dir=tmp_dir,
                test_method_name=self._testMethodName,
            )
            unencrypted = self.export(
                tmp_dir, scope=ExportScope.Organization, checkpointer=unencrypted_checkpointer
            )
            self.verify_model_inclusion(unencrypted, ExportScope.Organization)

            first_pass_cache_writes = unencrypted_checkpointer.cache_writes
            assert unencrypted_checkpointer.cache_hits == 0
            assert unencrypted_checkpointer.cache_misses > 0
            assert unencrypted_checkpointer.cache_misses == first_pass_cache_writes

            # The following re-run of `self.export` should only use the checkpoint cache. After
            # completion, we should have no new writes, and no new misses; only hits should be
            # incremented.
            self.export(
                tmp_dir, scope=ExportScope.Organization, checkpointer=unencrypted_checkpointer
            )
            assert unencrypted_checkpointer.cache_hits == first_pass_cache_writes
            assert unencrypted_checkpointer.cache_misses == first_pass_cache_writes
            assert unencrypted_checkpointer.cache_writes == first_pass_cache_writes

            rsa_key_pair = generate_rsa_key_pair()
            (private_key_pem, public_key_pem) = rsa_key_pair
            encrypted_checkpointer = FakeExportCheckpointer(
                crypto=EncryptorDecryptorPair(
                    encryptor=LocalFileEncryptor(BytesIO(public_key_pem)),
                    decryptor=LocalFileDecryptor(BytesIO(private_key_pem)),
                ),
                printer=NOOP_PRINTER,
                tmp_dir=tmp_dir,
                test_method_name=self._testMethodName,
            )
            encrypted = self.export_and_encrypt(
                tmp_dir,
                scope=ExportScope.Organization,
                rsa_key_pair=rsa_key_pair,
                checkpointer=encrypted_checkpointer,
            )
            assert unencrypted == encrypted

            assert encrypted_checkpointer.cache_hits == 0
            assert encrypted_checkpointer.cache_misses == first_pass_cache_writes
            assert encrypted_checkpointer.cache_writes == first_pass_cache_writes

            # The following re-run of `self.export_and_encrypt` should only use the checkpoint
            # cache. After completion, we should have no new writes, and no new misses; only hits
            # should be incremented.
            self.export_and_encrypt(
                tmp_dir,
                scope=ExportScope.Organization,
                rsa_key_pair=rsa_key_pair,
                checkpointer=encrypted_checkpointer,
            )
            assert encrypted_checkpointer.cache_hits == first_pass_cache_writes
            assert encrypted_checkpointer.cache_misses == first_pass_cache_writes
            assert encrypted_checkpointer.cache_writes == first_pass_cache_writes

    @freeze_time("2023-10-11 18:00:00")
    def test_config_export_scoping(self):
        self.create_exhaustive_instance(is_superadmin=True)
        admin = self.create_exhaustive_user("admin", is_admin=True)
        staff = self.create_exhaustive_user("staff", is_staff=True)
        superuser = self.create_exhaustive_user("superuser", is_superuser=True)
        self.create_exhaustive_api_keys_for_user(admin)
        self.create_exhaustive_api_keys_for_user(staff)
        self.create_exhaustive_api_keys_for_user(superuser)
        with TemporaryDirectory() as tmp_dir:
            unencrypted_checkpointer = FakeExportCheckpointer(
                crypto=None,
                printer=NOOP_PRINTER,
                tmp_dir=tmp_dir,
                test_method_name=self._testMethodName,
            )
            unencrypted = self.export(
                tmp_dir, scope=ExportScope.Config, checkpointer=unencrypted_checkpointer
            )
            self.verify_model_inclusion(unencrypted, ExportScope.Config)

            first_pass_cache_writes = unencrypted_checkpointer.cache_writes
            assert unencrypted_checkpointer.cache_hits == 0
            assert unencrypted_checkpointer.cache_misses > 0
            assert unencrypted_checkpointer.cache_misses == first_pass_cache_writes

            # The following re-run of `self.export` should only use the checkpoint cache. After
            # completion, we should have no new writes, and no new misses; only hits should be
            # incremented.
            self.export(tmp_dir, scope=ExportScope.Config, checkpointer=unencrypted_checkpointer)
            assert unencrypted_checkpointer.cache_hits == first_pass_cache_writes
            assert unencrypted_checkpointer.cache_misses == first_pass_cache_writes
            assert unencrypted_checkpointer.cache_writes == first_pass_cache_writes

            rsa_key_pair = generate_rsa_key_pair()
            (private_key_pem, public_key_pem) = rsa_key_pair
            encrypted_checkpointer = FakeExportCheckpointer(
                crypto=EncryptorDecryptorPair(
                    encryptor=LocalFileEncryptor(BytesIO(public_key_pem)),
                    decryptor=LocalFileDecryptor(BytesIO(private_key_pem)),
                ),
                printer=NOOP_PRINTER,
                tmp_dir=tmp_dir,
                test_method_name=self._testMethodName,
            )
            encrypted = self.export_and_encrypt(
                tmp_dir,
                scope=ExportScope.Config,
                rsa_key_pair=rsa_key_pair,
                checkpointer=encrypted_checkpointer,
            )
            assert unencrypted == encrypted

            assert encrypted_checkpointer.cache_hits == 0
            assert encrypted_checkpointer.cache_misses == first_pass_cache_writes
            assert encrypted_checkpointer.cache_writes == first_pass_cache_writes

            # The following re-run of `self.export_and_encrypt` should only use the checkpoint
            # cache. After completion, we should have no new writes, and no new misses; only hits
            # should be incremented.
            self.export_and_encrypt(
                tmp_dir,
                scope=ExportScope.Config,
                rsa_key_pair=rsa_key_pair,
                checkpointer=encrypted_checkpointer,
            )
            assert encrypted_checkpointer.cache_hits == first_pass_cache_writes
            assert encrypted_checkpointer.cache_misses == first_pass_cache_writes
            assert encrypted_checkpointer.cache_writes == first_pass_cache_writes

    @freeze_time("2023-10-11 18:00:00")
    def test_global_export_scoping(self):
        self.create_exhaustive_instance(is_superadmin=True)
        with TemporaryDirectory() as tmp_dir:
            unencrypted_checkpointer = FakeExportCheckpointer(
                crypto=None,
                printer=NOOP_PRINTER,
                tmp_dir=tmp_dir,
                test_method_name=self._testMethodName,
            )
            unencrypted = self.export(
                tmp_dir, scope=ExportScope.Global, checkpointer=unencrypted_checkpointer
            )
            self.verify_model_inclusion(unencrypted, ExportScope.Global)

            first_pass_cache_writes = unencrypted_checkpointer.cache_writes
            assert unencrypted_checkpointer.cache_hits == 0
            assert unencrypted_checkpointer.cache_misses > 0
            assert unencrypted_checkpointer.cache_misses == first_pass_cache_writes

            # The following re-run of `self.export` should only use the checkpoint cache. After
            # completion, we should have no new writes, and no new misses; only hits should be
            # incremented.
            self.export(tmp_dir, scope=ExportScope.Global, checkpointer=unencrypted_checkpointer)
            assert unencrypted_checkpointer.cache_hits == first_pass_cache_writes
            assert unencrypted_checkpointer.cache_misses == first_pass_cache_writes
            assert unencrypted_checkpointer.cache_writes == first_pass_cache_writes

            rsa_key_pair = generate_rsa_key_pair()
            (private_key_pem, public_key_pem) = rsa_key_pair
            encrypted_checkpointer = FakeExportCheckpointer(
                crypto=EncryptorDecryptorPair(
                    encryptor=LocalFileEncryptor(BytesIO(public_key_pem)),
                    decryptor=LocalFileDecryptor(BytesIO(private_key_pem)),
                ),
                printer=NOOP_PRINTER,
                tmp_dir=tmp_dir,
                test_method_name=self._testMethodName,
            )
            encrypted = self.export_and_encrypt(
                tmp_dir,
                scope=ExportScope.Global,
                rsa_key_pair=rsa_key_pair,
                checkpointer=encrypted_checkpointer,
            )
            assert unencrypted == encrypted

            assert encrypted_checkpointer.cache_hits == 0
            assert encrypted_checkpointer.cache_misses == first_pass_cache_writes
            assert encrypted_checkpointer.cache_writes == first_pass_cache_writes

            # The following re-run of `self.export_and_encrypt` should only use the checkpoint
            # cache. After completion, we should have no new writes, and no new misses; only hits
            # should be incremented.
            self.export_and_encrypt(
                tmp_dir,
                scope=ExportScope.Global,
                rsa_key_pair=rsa_key_pair,
                checkpointer=encrypted_checkpointer,
            )
            assert encrypted_checkpointer.cache_hits == first_pass_cache_writes
            assert encrypted_checkpointer.cache_misses == first_pass_cache_writes
            assert encrypted_checkpointer.cache_writes == first_pass_cache_writes


# Filters should work identically in both silo and monolith modes, so no need to repeat the tests
# here.
class FilteringTests(ExportTestCase):
    """
    Ensures that filtering operations include the correct models.
    """

    def test_export_filter_users(self):
        self.create_exhaustive_user("user_1")
        self.create_exhaustive_user("user_2")

        with TemporaryDirectory() as tmp_dir:
            data = self.export(tmp_dir, scope=ExportScope.User, filter_by={"user_2"})

            # Count users, but also count a random model naively derived from just `User` alone,
            # like `UserEmail`. Because `Email` and `UserEmail` have some automagic going on that
            # causes them to be created when a `User` is, we explicitly check to ensure that they
            # are behaving correctly as well.
            assert self.count(data, User) == 1
            assert self.count(data, UserEmail) == 1
            assert self.count(data, Email) == 1

            assert not self.exists(data, User, "username", "user_1")
            assert self.exists(data, User, "username", "user_2")

    def test_export_filter_users_shared_email(self):
        self.create_exhaustive_user("user_1", email="a@example.com")
        self.create_exhaustive_user("user_2", email="b@example.com")
        self.create_exhaustive_user("user_3", email="a@example.com")
        self.create_exhaustive_user("user_4", email="b@example.com")

        with TemporaryDirectory() as tmp_dir:
            data = self.export(
                tmp_dir,
                scope=ExportScope.User,
                filter_by={"user_1", "user_2", "user_3"},
            )

            assert self.count(data, User) == 3
            assert self.count(data, UserEmail) == 3
            assert self.count(data, Email) == 2

            assert self.exists(data, User, "username", "user_1")
            assert self.exists(data, User, "username", "user_2")
            assert self.exists(data, User, "username", "user_3")
            assert not self.exists(data, User, "username", "user_4")

    def test_export_filter_users_empty(self):
        self.create_exhaustive_user("user_1")
        self.create_exhaustive_user("user_2")

        with TemporaryDirectory() as tmp_dir:
            data = self.export(tmp_dir, scope=ExportScope.User, filter_by=set())

            assert len(data) == 0

    def test_export_filter_orgs_single(self):
        # Create a superadmin not in any orgs, so that we can test that `OrganizationMember`s
        # invited by users outside of their org are still properly exported.
        superadmin = self.create_exhaustive_user(
            "superadmin", is_admin=True, is_superuser=True, is_staff=True
        )
        a = self.create_exhaustive_user("user_a_only", email="shared@example.com")
        b = self.create_exhaustive_user("user_b_only", email="shared@example.com")
        c = self.create_exhaustive_user("user_c_only", email="shared@example.com")
        a_b = self.create_exhaustive_user("user_a_and_b")
        a_c = self.create_exhaustive_user("user_a_and_c")
        b_c = self.create_exhaustive_user("user_b_and_c")
        a_b_c = self.create_exhaustive_user("user_all", email="shared@example.com")
        org_a = self.create_exhaustive_organization("org-a", a, a_b, [a_b_c])
        org_b = self.create_exhaustive_organization(
            "org-b",
            owner=b_c,
            member=a_b_c,
            other_members=[b, a_b],
            pending_invites={
                superadmin: "invited-by-superadmin-not-in-org@example.com",
                b_c: "invited-by-org-owner@example.com",
                a_b_c: "invited-by-org-member@example.com",
            },
            accepted_invites={
                superadmin: [self.create_exhaustive_user("added-by-superadmin-not-in-org")],
                b_c: [self.create_exhaustive_user("added-by-org-owner")],
                a_b_c: [self.create_exhaustive_user("added-by-org-member")],
            },
        )
        org_c = self.create_exhaustive_organization("org-c", a_b_c, a_c, [c])

        # Add an invited email to each org.
        OrganizationMember.objects.create(
            organization=org_a, inviter_id=a.id, role="member", email="invited-a@example.com"
        )
        OrganizationMember.objects.create(
            organization=org_b, inviter_id=b.id, role="member", email="invited-b@example.com"
        )
        OrganizationMember.objects.create(
            organization=org_c, inviter_id=c.id, role="member", email="invited-c@example.com"
        )

        with TemporaryDirectory() as tmp_dir:
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

            assert self.count(data, User) == 7
            assert self.count(data, UserEmail) == 7
            assert self.count(data, Email) == 6  # Lower due to `shared@example.com`

            assert not self.exists(data, User, "username", "user_a_only")
            assert self.exists(data, User, "username", "user_b_only")
            assert not self.exists(data, User, "username", "user_c_only")
            assert self.exists(data, User, "username", "user_a_and_b")
            assert self.exists(data, User, "username", "user_b_and_c")
            assert self.exists(data, User, "username", "user_all")
            assert self.exists(data, User, "username", "added-by-superadmin-not-in-org")
            assert self.exists(data, User, "username", "added-by-org-owner")
            assert self.exists(data, User, "username", "added-by-org-member")

            # Invited, uninvited, and pending invite members should all export fine...
            assert self.exists(data, OrganizationMember, "user_email", "added-by-org-owner")
            assert self.exists(data, OrganizationMember, "user_email", "added-by-org-owner")
            assert self.exists(
                data, OrganizationMember, "user_email", "added-by-superadmin-not-in-org"
            )
            assert self.exists(
                data, OrganizationMember, "email", "invited-by-superadmin-not-in-org@example.com"
            )
            assert self.exists(
                data, OrganizationMember, "email", "invited-by-org-member@example.com"
            )

            # ...but not members of different orgs.
            assert not self.exists(data, OrganizationMember, "user_email", "user_a_and_c")

    def test_export_filter_orgs_multiple(self):
        # Create a superadmin not in any orgs, so that we can test that `OrganizationMember`s
        # invited by users outside of their org are still properly exported.
        superadmin = self.create_exhaustive_user(
            "superadmin", is_admin=True, is_superuser=True, is_staff=True
        )
        a = self.create_exhaustive_user("user_a_only", email="shared@example.com")
        b = self.create_exhaustive_user("user_b_only", email="shared@example.com")
        c = self.create_exhaustive_user("user_c_only", email="shared@example.com")
        a_b = self.create_exhaustive_user("user_a_and_b")
        b_c = self.create_exhaustive_user("user_b_and_c")
        a_b_c = self.create_exhaustive_user("user_all", email="shared@example.com")
        org_a = self.create_exhaustive_organization(
            "org-a",
            owner=a,
            member=a_b,
            other_members=[a_b_c],
            pending_invites={
                superadmin: "invited-by-superadmin-not-in-org@example.com",
                a: "invited-by-org-owner@example.com",
                a_b: "invited-by-org-member@example.com",
            },
            accepted_invites={
                superadmin: [self.create_exhaustive_user("added-by-superadmin-not-in-org")],
                a: [self.create_exhaustive_user("added-by-org-owner")],
                a_b: [self.create_exhaustive_user("added-by-org-member")],
            },
        )
        org_b = self.create_exhaustive_organization("org-b", b_c, a_b_c, [b, a_b])
        org_c = self.create_exhaustive_organization("org-c", a_b_c, b_c, [c])

        # Add an invited email to each org.
        OrganizationMember.objects.create(
            organization=org_a, inviter_id=a.id, role="member", email="invited-a@example.com"
        )
        OrganizationMember.objects.create(
            organization=org_b, inviter_id=b.id, role="member", email="invited-b@example.com"
        )
        OrganizationMember.objects.create(
            organization=org_c, inviter_id=c.id, role="member", email="invited-c@example.com"
        )

        with TemporaryDirectory() as tmp_dir:
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

            assert self.count(data, User) == 8
            assert self.count(data, UserEmail) == 8
            assert self.count(data, Email) == 6  # Lower due to `shared@example.com`

            assert self.exists(data, User, "username", "user_a_only")
            assert not self.exists(data, User, "username", "user_b_only")
            assert self.exists(data, User, "username", "user_c_only")
            assert self.exists(data, User, "username", "user_a_and_b")
            assert self.exists(data, User, "username", "user_b_and_c")
            assert self.exists(data, User, "username", "user_all")
            assert self.exists(data, User, "username", "added-by-superadmin-not-in-org")
            assert self.exists(data, User, "username", "added-by-org-owner")
            assert self.exists(data, User, "username", "added-by-org-member")

            # Invited, uninvited, and pending invite members should all export fine...
            assert self.exists(data, OrganizationMember, "user_email", "added-by-org-owner")
            assert self.exists(data, OrganizationMember, "user_email", "added-by-org-owner")
            assert self.exists(
                data, OrganizationMember, "user_email", "added-by-superadmin-not-in-org"
            )
            assert self.exists(
                data, OrganizationMember, "email", "invited-by-superadmin-not-in-org@example.com"
            )
            assert self.exists(
                data, OrganizationMember, "email", "invited-by-org-member@example.com"
            )

            # ...but not members of different, unexported orgs.
            assert not self.exists(data, OrganizationMember, "user_email", "user_b_only")
            assert not self.exists(data, OrganizationMember, "email", "invited-b@example.com")

    """
    If this test fails, it's because a newly created model was given an relocation_scope
    that is not correctly exporting the models created in backup.py

    To fix this you can:
    - Add a reference to the organization model
    - Remove the model from the relocation scope; using RelocationScope.Excluded
    - Reach out to #discuss-open-source on slack for customizations / more detailed support
    """

    def test_export_filter_orgs_empty(self):
        a = self.create_exhaustive_user("user_a_only")
        b = self.create_exhaustive_user("user_b_only")
        c = self.create_exhaustive_user("user_c_only")
        a_b = self.create_exhaustive_user("user_a_and_b")
        b_c = self.create_exhaustive_user("user_b_and_c")
        a_b_c = self.create_exhaustive_user("user_all")
        org_a = self.create_exhaustive_organization("org-a", a, a_b, [a_b_c])
        org_b = self.create_exhaustive_organization("org-b", b_c, a_b_c, [b, a_b])
        org_c = self.create_exhaustive_organization("org-c", a_b_c, b_c, [c])

        # Add an invited email to each org.
        OrganizationMember.objects.create(
            organization=org_a, inviter_id=a.id, role="member", email="invited-a@example.com"
        )
        OrganizationMember.objects.create(
            organization=org_b, inviter_id=b.id, role="member", email="invited-b@example.com"
        )
        OrganizationMember.objects.create(
            organization=org_c, inviter_id=c.id, role="member", email="invited-c@example.com"
        )

        with TemporaryDirectory() as tmp_dir:
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

        with TemporaryDirectory() as tmp_dir:
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


class QueryTests(ExportTestCase):
    """
    Some models have custom export logic that requires bespoke testing.
    """

    def test_export_query_for_option_model(self):
        # There are a number of options we specifically exclude by name, for various reasons
        # enumerated in that model's definition file.
        Option.objects.create(key="sentry:install-id", value='"excluded"')
        Option.objects.create(key="sentry:latest_version", value='"excluded"')
        Option.objects.create(key="sentry:last_worker_ping", value='"excluded"')
        Option.objects.create(key="sentry:last_worker_version", value='"excluded"')

        Option.objects.create(key="sentry:test-unfiltered", value="included")
        Option.objects.create(key="foo:bar", value='"included"')

        with TemporaryDirectory() as tmp_dir:
            data = self.export(
                tmp_dir,
                scope=ExportScope.Config,
            )

            assert self.count(data, Option) == 2
            assert not self.exists(data, Option, "key", "sentry:install-id")
            assert not self.exists(data, Option, "key", "sentry:last_version")
            assert not self.exists(data, Option, "key", "sentry:last_worker_ping")
            assert not self.exists(data, Option, "key", "sentry:last_worker_version")
            assert not self.exists(data, Option, "value", '"excluded"')
            assert self.exists(data, Option, "key", "sentry:test-unfiltered")
            assert self.exists(data, Option, "key", "foo:bar")
            assert self.exists(data, Option, "value", '"included"')
