from unittest.mock import patch

import pytest
from django.db import IntegrityError
from django.test import override_settings

from sentry.conf.types.sentry_config import SentryMode
from sentry.silo.base import SiloMode
from sentry.tasks.scim.privilege_sync import (
    sync_scim_team_privileges,
    update_privilege,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.users.models.user import User
from sentry.users.services.user.service import user_service


@region_silo_test
class UpdatePrivilegeGrantTest(TestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user(email="test@example.com")

    def test_grant_staff(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not User.objects.get(id=self.user.id).is_staff

        update_privilege(
            self.user.id, {"is_staff": True}, grant=True, manage_write_permission=False
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert User.objects.get(id=self.user.id).is_staff

    def test_grant_superuser(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not User.objects.get(id=self.user.id).is_superuser

        update_privilege(
            self.user.id, {"is_superuser": True}, grant=True, manage_write_permission=False
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert User.objects.get(id=self.user.id).is_superuser

    def test_grant_superuser_write_sets_superuser_and_permission(self):
        from sentry.users.models.userpermission import UserPermission

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not UserPermission.objects.filter(
                user_id=self.user.id, permission="superuser.write"
            ).exists()

        update_privilege(
            self.user.id, {"is_superuser": True}, grant=True, manage_write_permission=True
        )

        user = user_service.get_user(user_id=self.user.id)
        assert user is not None
        assert user.is_superuser

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert UserPermission.objects.filter(
                user_id=self.user.id, permission="superuser.write"
            ).exists()

    def test_grant_superuser_write_rolls_back_permission_on_failure(self):
        from sentry.users.models.userpermission import UserPermission

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not UserPermission.objects.filter(
                user_id=self.user.id, permission="superuser.write"
            ).exists()

        with patch("sentry.tasks.scim.privilege_sync.user_service.update_user") as mock_update:
            mock_update.side_effect = Exception("RPC failure")

            with pytest.raises(Exception, match="RPC failure"):
                update_privilege(
                    self.user.id,
                    {"is_superuser": True},
                    grant=True,
                    manage_write_permission=True,
                )

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not UserPermission.objects.filter(
                user_id=self.user.id, permission="superuser.write"
            ).exists()

    def test_grant_superuser_write_integrity_error_removes_permission_without_raising(self):
        from sentry.users.models.userpermission import UserPermission

        with patch("sentry.tasks.scim.privilege_sync.user_service.update_user") as mock_update:
            mock_update.side_effect = IntegrityError("user deleted")

            update_privilege(
                self.user.id,
                {"is_superuser": True},
                grant=True,
                manage_write_permission=True,
            )

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not UserPermission.objects.filter(
                user_id=self.user.id, permission="superuser.write"
            ).exists()


@region_silo_test
class UpdatePrivilegeRevokeTest(TestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user(email="test@example.com")

    def test_revoke_staff(self):
        user_service.update_user(user_id=self.user.id, attrs={"is_staff": True})

        update_privilege(
            self.user.id, {"is_staff": False}, grant=False, manage_write_permission=False
        )

        user = user_service.get_user(user_id=self.user.id)
        assert user is not None
        assert not user.is_staff

    def test_revoke_superuser(self):
        user_service.update_user(user_id=self.user.id, attrs={"is_superuser": True})

        update_privilege(
            self.user.id, {"is_superuser": False}, grant=False, manage_write_permission=False
        )

        user = user_service.get_user(user_id=self.user.id)
        assert user is not None
        assert not user.is_superuser

    def test_revoke_superuser_write_removes_permission_and_superuser(self):
        from sentry.users.models.userpermission import UserPermission

        user_service.update_user(user_id=self.user.id, attrs={"is_superuser": True})
        with assume_test_silo_mode(SiloMode.CONTROL):
            UserPermission.objects.create(user_id=self.user.id, permission="superuser.write")

        update_privilege(
            self.user.id, {"is_superuser": False}, grant=False, manage_write_permission=True
        )

        user = user_service.get_user(user_id=self.user.id)
        assert user is not None
        assert not user.is_superuser

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not UserPermission.objects.filter(
                user_id=self.user.id, permission="superuser.write"
            ).exists()

    def test_revoke_superuser_write_failure_keeps_permission_removed(self):
        from sentry.users.models.userpermission import UserPermission

        user_service.update_user(
            user_id=self.user.id, attrs={"is_staff": True, "is_superuser": True}
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            UserPermission.objects.create(user_id=self.user.id, permission="superuser.write")

        with patch("sentry.tasks.scim.privilege_sync.user_service.update_user") as mock_update:
            mock_update.side_effect = Exception("RPC failure")

            with pytest.raises(Exception, match="RPC failure"):
                update_privilege(
                    self.user.id,
                    {"is_superuser": False},
                    grant=False,
                    manage_write_permission=True,
                )

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not UserPermission.objects.filter(
                user_id=self.user.id, permission="superuser.write"
            ).exists()


PRIVILEGE_SETTINGS = {
    "SENTRY_SCIM_STAFF_TEAM_SLUG": "snty-staff",
    "SENTRY_SCIM_SUPERUSER_READ_TEAM_SLUG": "snty-superuser-read",
    "SENTRY_SCIM_SUPERUSER_WRITE_TEAM_SLUG": "snty-superuser-write",
}


@region_silo_test
class SyncScimTeamPrivilegesTaskTest(TestCase):
    def setUp(self):
        super().setUp()
        self.user_one = self.create_user(email="user1@example.com")
        self.user_two = self.create_user(email="user2@example.com")
        self.organization = self.create_organization(name="Test Org")

    def test_non_saas_mode_is_noop(self):
        with override_settings(
            SENTRY_MODE=SentryMode.SELF_HOSTED,
            SUPERUSER_ORG_ID=self.organization.id,
            **PRIVILEGE_SETTINGS,
        ):
            sync_scim_team_privileges(
                team_slug="snty-staff",
                organization_id=self.organization.id,
                user_ids_to_grant=[self.user_one.id],
                user_ids_to_revoke=[],
            )

            user = user_service.get_user(user_id=self.user_one.id)
            assert user is not None
            assert not user.is_staff

    def test_wrong_org_is_noop(self):
        other_org = self.create_organization(name="Other Org")
        with override_settings(
            SENTRY_MODE=SentryMode.SAAS,
            SUPERUSER_ORG_ID=other_org.id,
            **PRIVILEGE_SETTINGS,
        ):
            sync_scim_team_privileges(
                team_slug="snty-staff",
                organization_id=self.organization.id,
                user_ids_to_grant=[self.user_one.id],
                user_ids_to_revoke=[],
            )

            user = user_service.get_user(user_id=self.user_one.id)
            assert user is not None
            assert not user.is_staff

    def test_batch_grant_and_revoke(self):
        user_service.update_user(user_id=self.user_two.id, attrs={"is_staff": True})

        with override_settings(
            SENTRY_MODE=SentryMode.SAAS,
            SUPERUSER_ORG_ID=self.organization.id,
            **PRIVILEGE_SETTINGS,
        ):
            sync_scim_team_privileges(
                team_slug="snty-staff",
                organization_id=self.organization.id,
                user_ids_to_grant=[self.user_one.id],
                user_ids_to_revoke=[self.user_two.id],
            )

            user_one = user_service.get_user(user_id=self.user_one.id)
            assert user_one is not None
            assert user_one.is_staff

            user_two = user_service.get_user(user_id=self.user_two.id)
            assert user_two is not None
            assert not user_two.is_staff

    def test_grant_failure_raises(self):
        with override_settings(
            SENTRY_MODE=SentryMode.SAAS,
            SUPERUSER_ORG_ID=self.organization.id,
            **PRIVILEGE_SETTINGS,
        ):
            with patch("sentry.tasks.scim.privilege_sync.update_privilege") as mock_update:
                mock_update.side_effect = Exception("grant failure")

                with pytest.raises(Exception, match="grant failure"):
                    sync_scim_team_privileges(
                        team_slug="snty-staff",
                        organization_id=self.organization.id,
                        user_ids_to_grant=[self.user_one.id],
                        user_ids_to_revoke=[],
                    )

    def test_revoke_failure_raises(self):
        with override_settings(
            SENTRY_MODE=SentryMode.SAAS,
            SUPERUSER_ORG_ID=self.organization.id,
            **PRIVILEGE_SETTINGS,
        ):
            with patch("sentry.tasks.scim.privilege_sync.update_privilege") as mock_update:
                mock_update.side_effect = Exception("revoke failure")

                with pytest.raises(Exception, match="revoke failure"):
                    sync_scim_team_privileges(
                        team_slug="snty-staff",
                        organization_id=self.organization.id,
                        user_ids_to_grant=[],
                        user_ids_to_revoke=[self.user_one.id],
                    )

    def test_unknown_team_slug_is_noop(self):
        with override_settings(
            SENTRY_MODE=SentryMode.SAAS,
            SUPERUSER_ORG_ID=self.organization.id,
            **PRIVILEGE_SETTINGS,
        ):
            sync_scim_team_privileges(
                team_slug="some-random-team",
                organization_id=self.organization.id,
                user_ids_to_grant=[self.user_one.id],
                user_ids_to_revoke=[],
            )

            user = user_service.get_user(user_id=self.user_one.id)
            assert user is not None
            assert not user.is_staff
            assert not user.is_superuser

    def test_empty_lists_is_noop(self):
        with override_settings(
            SENTRY_MODE=SentryMode.SAAS,
            SUPERUSER_ORG_ID=self.organization.id,
            **PRIVILEGE_SETTINGS,
        ):
            sync_scim_team_privileges(
                team_slug="snty-staff",
                organization_id=self.organization.id,
                user_ids_to_grant=[],
                user_ids_to_revoke=[],
            )

            user_one = user_service.get_user(user_id=self.user_one.id)
            assert user_one is not None
            assert not user_one.is_staff
