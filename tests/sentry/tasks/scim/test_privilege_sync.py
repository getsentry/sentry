from unittest.mock import patch

import pytest
from django.db import IntegrityError
from django.test import override_settings

from sentry.conf.types.sentry_config import SentryMode
from sentry.silo.base import SiloMode
from sentry.tasks.scim.privilege_sync import (
    grant_privilege,
    revoke_privilege,
    sync_scim_team_privileges,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.users.services.user.service import user_service

PRIVILEGE_SETTINGS = {
    "SENTRY_SCIM_STAFF_TEAM_SLUG": "snty-staff",
    "SENTRY_SCIM_SUPERUSER_READ_TEAM_SLUG": "snty-superuser-read",
    "SENTRY_SCIM_SUPERUSER_WRITE_TEAM_SLUG": "snty-superuser-write",
}


@control_silo_test
class GrantPrivilegeTest(TestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user(email="test@example.com")
        self.organization = self.create_organization(name="Test Org")

    @override_settings(**PRIVILEGE_SETTINGS)
    def test_staff_grant_sets_is_staff(self):
        user = user_service.get_user(user_id=self.user.id)
        assert user is not None
        assert not user.is_staff

        grant_privilege(self.user.id, "snty-staff")

        user = user_service.get_user(user_id=self.user.id)
        assert user is not None
        assert user.is_staff

    @override_settings(**PRIVILEGE_SETTINGS)
    def test_superuser_read_grant_sets_is_superuser(self):
        user = user_service.get_user(user_id=self.user.id)
        assert user is not None
        assert not user.is_superuser

        grant_privilege(self.user.id, "snty-superuser-read")

        user = user_service.get_user(user_id=self.user.id)
        assert user is not None
        assert user.is_superuser

    @override_settings(**PRIVILEGE_SETTINGS)
    def test_superuser_write_grant_sets_is_superuser_and_permission(self):
        from sentry.users.models.userpermission import UserPermission

        user = user_service.get_user(user_id=self.user.id)
        assert user is not None
        assert not user.is_superuser

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not UserPermission.objects.filter(
                user_id=self.user.id, permission="superuser.write"
            ).exists()

        grant_privilege(self.user.id, "snty-superuser-write")

        user = user_service.get_user(user_id=self.user.id)
        assert user is not None
        assert user.is_superuser

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert UserPermission.objects.filter(
                user_id=self.user.id, permission="superuser.write"
            ).exists()

    @override_settings(**PRIVILEGE_SETTINGS)
    def test_superuser_write_grant_failure_rolls_back_permission(self):
        from sentry.users.models.userpermission import UserPermission

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not UserPermission.objects.filter(
                user_id=self.user.id, permission="superuser.write"
            ).exists()

        with patch("sentry.tasks.scim.privilege_sync.user_service.update_user") as mock_update:
            mock_update.side_effect = Exception("RPC failure")

            with pytest.raises(Exception, match="RPC failure"):
                grant_privilege(self.user.id, "snty-superuser-write")

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not UserPermission.objects.filter(
                user_id=self.user.id, permission="superuser.write"
            ).exists()

    @override_settings(**PRIVILEGE_SETTINGS)
    def test_superuser_write_grant_integrity_error_removes_permission_without_raising(self):
        from sentry.users.models.userpermission import UserPermission

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not UserPermission.objects.filter(
                user_id=self.user.id, permission="superuser.write"
            ).exists()

        with patch("sentry.tasks.scim.privilege_sync.user_service.update_user") as mock_update:
            mock_update.side_effect = IntegrityError("user deleted")

            grant_privilege(self.user.id, "snty-superuser-write")

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not UserPermission.objects.filter(
                user_id=self.user.id, permission="superuser.write"
            ).exists()


@control_silo_test
class RevokePrivilegeTest(TestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user(email="test@example.com")
        self.organization = self.create_organization(name="Test Org")

    @override_settings(**PRIVILEGE_SETTINGS)
    def test_staff_revoke_sets_is_staff_false(self):
        user_service.update_user(user_id=self.user.id, attrs={"is_staff": True})

        user = user_service.get_user(user_id=self.user.id)
        assert user is not None
        assert user.is_staff

        revoke_privilege(self.user.id, "snty-staff")

        user = user_service.get_user(user_id=self.user.id)
        assert user is not None
        assert not user.is_staff

    @override_settings(**PRIVILEGE_SETTINGS)
    def test_superuser_read_revoke_sets_is_superuser_false(self):
        user_service.update_user(user_id=self.user.id, attrs={"is_superuser": True})

        user = user_service.get_user(user_id=self.user.id)
        assert user is not None
        assert user.is_superuser

        revoke_privilege(self.user.id, "snty-superuser-read")

        user = user_service.get_user(user_id=self.user.id)
        assert user is not None
        assert not user.is_superuser

    @override_settings(**PRIVILEGE_SETTINGS)
    def test_superuser_write_revoke_removes_permission_and_is_superuser(self):
        from sentry.users.models.userpermission import UserPermission

        user_service.update_user(user_id=self.user.id, attrs={"is_superuser": True})
        with assume_test_silo_mode(SiloMode.CONTROL):
            UserPermission.objects.create(user_id=self.user.id, permission="superuser.write")

        revoke_privilege(self.user.id, "snty-superuser-write")

        user = user_service.get_user(user_id=self.user.id)
        assert user is not None
        assert not user.is_superuser

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not UserPermission.objects.filter(
                user_id=self.user.id, permission="superuser.write"
            ).exists()

    @override_settings(**PRIVILEGE_SETTINGS)
    def test_superuser_write_revoke_failure_keeps_permission_removed(self):
        from sentry.users.models.userpermission import UserPermission

        user_service.update_user(
            user_id=self.user.id, attrs={"is_staff": True, "is_superuser": True}
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            UserPermission.objects.create(user_id=self.user.id, permission="superuser.write")

        with patch("sentry.tasks.scim.privilege_sync.user_service.update_user") as mock_update:
            mock_update.side_effect = Exception("RPC failure")

            try:
                revoke_privilege(self.user.id, "snty-superuser-write")
            except Exception:
                pass

        # Permission should stay removed (fail-secure)
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not UserPermission.objects.filter(
                user_id=self.user.id, permission="superuser.write"
            ).exists()


@control_silo_test
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
            with patch("sentry.tasks.scim.privilege_sync.grant_privilege") as mock_grant:
                mock_grant.side_effect = Exception("grant failure")

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
            with patch("sentry.tasks.scim.privilege_sync.revoke_privilege") as mock_revoke:
                mock_revoke.side_effect = Exception("revoke failure")

                with pytest.raises(Exception, match="revoke failure"):
                    sync_scim_team_privileges(
                        team_slug="snty-staff",
                        organization_id=self.organization.id,
                        user_ids_to_grant=[],
                        user_ids_to_revoke=[self.user_one.id],
                    )

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
