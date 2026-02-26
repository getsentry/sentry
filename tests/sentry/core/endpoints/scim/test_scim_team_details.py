from typing import Any
from unittest.mock import MagicMock, patch

from django.test import override_settings
from django.urls import reverse

from sentry.conf.types.sentry_config import SentryMode
from sentry.models.apitoken import ApiToken
from sentry.models.authprovider import AuthProvider as AuthProviderModel
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.team import Team, TeamStatus
from sentry.silo.base import SiloMode
from sentry.testutils.cases import SCIMTestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test


class SCIMDetailGetTest(SCIMTestCase):
    def test_team_details_404(self) -> None:
        url = reverse(
            "sentry-api-0-organization-scim-team-details",
            args=[self.organization.slug, 2],
        )
        response = self.client.get(url)
        assert response.status_code == 404, response.content

        assert response.data == {
            "detail": "Group not found.",
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
        }

    def test_scim_team_details_basic(self) -> None:
        team = self.create_team(
            organization=self.organization, name="test-scimv2", idp_provisioned=True
        )
        url = reverse(
            "sentry-api-0-organization-scim-team-details",
            args=[self.organization.slug, team.id],
        )
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
            "id": str(team.id),
            "displayName": "test-scimv2",
            "members": [],
            "meta": {"resourceType": "Group"},
        }

    def test_scim_team_details_excluded_attributes(self) -> None:
        team = self.create_team(
            organization=self.organization, name="test-scimv2", idp_provisioned=True
        )
        url = reverse(
            "sentry-api-0-organization-scim-team-details",
            args=[self.organization.slug, team.id],
        )
        response = self.client.get(f"{url}?excludedAttributes=members")
        assert response.status_code == 200, response.content
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
            "id": str(team.id),
            "displayName": "test-scimv2",
            "meta": {"resourceType": "Group"},
        }

    def test_team_doesnt_exist(self) -> None:
        url = reverse(
            "sentry-api-0-organization-scim-team-details", args=[self.organization.slug, 32340]
        )
        response = self.client.get(url)
        assert response.status_code == 404, response.data

        response = self.client.patch(url)
        assert response.status_code == 404, response.data

        response = self.client.delete(url)
        assert response.status_code == 404, response.data

    def test_team_details_put_permission_denied(self) -> None:
        url = reverse(
            "sentry-api-0-organization-scim-team-details",
            args=[self.organization.slug, self.team.id],
        )
        response = self.client.put(url)
        assert response.status_code == 403, response.data


class SCIMDetailPatchTest(SCIMTestCase):
    endpoint = "sentry-api-0-organization-scim-team-details"
    method = "patch"

    def setUp(self) -> None:
        super().setUp()
        self.team = self.create_team(organization=self.organization, idp_provisioned=True)
        self.base_data: dict[str, Any] = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        }
        self.member_one = self.create_member(
            user=self.create_user(), organization=self.organization
        )
        self.member_two = self.create_member(
            user=self.create_user(), organization=self.organization
        )
        self.member_on_team = self.create_member(
            user=self.create_user(), organization=self.organization, teams=[self.team]
        )

    def test_scim_team_details_invalid_patch_op(self) -> None:
        self.base_data["Operations"] = [
            {
                "op": "invalid",
                "value": {
                    "id": str(self.team.id),
                    "displayName": "newName",
                },
            }
        ]
        response = self.get_error_response(
            self.organization.slug, self.team.id, **self.base_data, status_code=400
        )
        assert "invalid" in response.data["detail"]

    @patch("sentry.core.endpoints.scim.teams.metrics")
    def test_scim_team_details_patch_rename_team(self, mock_metrics: MagicMock) -> None:
        self.base_data["Operations"] = [
            {
                "op": "replace",
                "value": {
                    "id": str(self.team.id),
                    "displayName": "newName",
                },
            }
        ]
        self.get_success_response(
            self.organization.slug, self.team.id, **self.base_data, status_code=204
        )
        assert Team.objects.get(id=self.team.id).slug == "newname"
        assert Team.objects.get(id=self.team.id).name == "newName"
        assert Team.objects.get(id=self.team.id).idp_provisioned
        mock_metrics.incr.assert_called_with(
            "sentry.scim.team.update", tags={"organization": self.organization}
        )

    def test_scim_team_details_patch_rename_team_invalid_slug(self) -> None:
        self.base_data["Operations"] = [
            {
                "op": "replace",
                "value": {
                    "id": str(self.team.id),
                    "displayName": "1234",
                },
            }
        ]
        response = self.get_error_response(
            self.organization.slug, self.team.id, **self.base_data, status_code=400
        )
        assert response.data["slug"][0] == (
            "Enter a valid slug consisting of lowercase letters, numbers, underscores or "
            "hyphens. It cannot be entirely numeric."
        )

    def test_scim_team_details_patch_add(self) -> None:
        self.base_data["Operations"] = [
            {
                "op": "add",
                "path": "members",
                "value": [
                    {
                        "value": self.member_one.id,
                        "display": self.member_one.email,
                    }
                ],
            },
        ]
        self.get_success_response(
            self.organization.slug, self.team.id, **self.base_data, status_code=204
        )
        assert OrganizationMemberTeam.objects.filter(
            team_id=str(self.team.id), organizationmember_id=self.member_one.id
        ).exists()
        assert Team.objects.get(id=self.team.id).idp_provisioned

    def test_scim_team_details_patch_remove(self) -> None:
        self.base_data["Operations"] = [
            {
                "op": "remove",
                "path": f'members[value eq "{self.member_one.id}"]',
            }
        ]
        self.get_success_response(
            self.organization.slug, self.team.id, **self.base_data, status_code=204
        )
        assert not OrganizationMemberTeam.objects.filter(
            team_id=self.team.id, organizationmember_id=self.member_one.id
        ).exists()
        assert Team.objects.get(id=self.team.id).idp_provisioned

    def test_team_details_replace_members_list(self) -> None:
        self.base_data["Operations"] = [
            {
                "op": "replace",
                "path": "members",
                "value": [
                    {
                        "value": self.member_one.id,
                        "display": "test.user@okta.local",
                    },
                    {
                        "value": self.member_two.id,
                        "display": "test.user2@okta.local",
                    },
                ],
            }
        ]
        self.get_success_response(
            self.organization.slug, self.team.id, **self.base_data, status_code=204
        )
        assert not OrganizationMemberTeam.objects.filter(
            team_id=self.team.id, organizationmember_id=self.member_on_team.id
        ).exists()
        assert OrganizationMemberTeam.objects.filter(
            team_id=self.team.id, organizationmember_id=self.member_one.id
        ).exists()
        assert OrganizationMemberTeam.objects.filter(
            team_id=self.team.id, organizationmember_id=self.member_two.id
        ).exists()
        assert Team.objects.get(id=self.team.id).idp_provisioned

    def test_team_member_doesnt_exist_add_to_team(self) -> None:
        self.base_data["Operations"] = [
            {
                "op": "add",
                "path": "members",
                "value": [
                    {
                        "value": "100232",
                        "display": "nope@doesnotexist.io",
                    }
                ],
            },
        ]
        response = self.get_error_response(
            self.organization.slug, self.team.id, **self.base_data, status_code=404
        )
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "detail": "User not found.",
        }

    def test_team_details_patch_too_many_ops(self) -> None:
        self.base_data["Operations"] = [{"op": "replace"}] * 101
        response = self.get_error_response(
            self.organization.slug, self.team.id, **self.base_data, status_code=400
        )

        assert response.status_code == 400, response.data
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "detail": "Too many patch ops sent, limit is 100.",
        }

    def test_team_details_invalid_filter_patch_route(self) -> None:
        self.base_data["Operations"] = [
            {
                "op": "remove",
                "path": 'members[value badop "1"]',
            }
        ]
        response = self.get_error_response(
            self.organization.slug, self.team.id, **self.base_data, status_code=400
        )

        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "scimType": "invalidFilter",
        }

    def test_rename_team_azure_request(self) -> None:
        self.base_data["Operations"] = [
            {"op": "Replace", "path": "displayName", "value": "theNewName"}
        ]
        self.get_success_response(
            self.organization.slug, self.team.id, **self.base_data, status_code=204
        )
        assert Team.objects.get(id=self.team.id).slug == "thenewname"
        assert Team.objects.get(id=self.team.id).idp_provisioned

    def test_remove_member_azure(self) -> None:
        self.base_data["Operations"] = [
            {"op": "Remove", "path": "members", "value": [{"value": str(self.member_on_team.id)}]}
        ]
        self.get_success_response(
            self.organization.slug, self.team.id, **self.base_data, status_code=204
        )
        assert not OrganizationMemberTeam.objects.filter(
            team_id=self.team.id, organizationmember_id=self.member_on_team.id
        ).exists()
        assert Team.objects.get(id=self.team.id).idp_provisioned

    def test_remove_member_not_on_team(self) -> None:
        self.base_data["Operations"] = [
            {
                "op": "Remove",
                "path": "members",
                "value": [{"value": str(self.member_one.id)}],
            }
        ]
        self.get_success_response(
            self.organization.slug, self.team.id, **self.base_data, status_code=204
        )
        assert not OrganizationMemberTeam.objects.filter(
            team_id=self.team.id, organizationmember_id=self.member_one.id
        ).exists()
        assert Team.objects.get(id=self.team.id).idp_provisioned


class SCIMDetailDeleteTest(SCIMTestCase):
    endpoint = "sentry-api-0-organization-scim-team-details"
    method = "delete"

    @patch("sentry.core.endpoints.scim.teams.metrics")
    def test_delete_team(self, mock_metrics: MagicMock) -> None:
        team = self.create_team(organization=self.organization, idp_provisioned=True)
        self.get_success_response(self.organization.slug, team.id, status_code=204)

        assert Team.objects.get(id=team.id).status == TeamStatus.PENDING_DELETION
        mock_metrics.incr.assert_called_with("sentry.scim.team.delete")


@region_silo_test
class SCIMPrivilegeManagementTest(SCIMTestCase):
    endpoint = "sentry-api-0-organization-scim-team-details"
    method = "patch"

    def setUp(self) -> None:
        super().setUp()

        self.base_data: dict[str, Any] = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        }

        self.user_one = self.create_user(email="staff_user@example.com")
        self.member_one = self.create_member(user=self.user_one, organization=self.organization)

        self.user_two = self.create_user(email="superuser_user@example.com")
        self.member_two = self.create_member(user=self.user_two, organization=self.organization)

    def test_adding_to_staff_group_dispatches_task(self) -> None:
        with override_settings(
            SENTRY_MODE=SentryMode.SAAS,
            SUPERUSER_ORG_ID=self.organization.id,
            SENTRY_SCIM_STAFF_TEAM_SLUG="snty-staff",
            SENTRY_SCIM_SUPERUSER_READ_TEAM_SLUG="snty-superuser-read",
            SENTRY_SCIM_SUPERUSER_WRITE_TEAM_SLUG="snty-superuser-write",
        ):
            staff_team = self.create_team(
                organization=self.organization, slug="snty-staff", idp_provisioned=True
            )
            assert not self.user_one.is_staff

            self.base_data["Operations"] = [
                {
                    "op": "add",
                    "path": "members",
                    "value": [
                        {
                            "value": self.member_one.id,
                            "display": self.member_one.email,
                        }
                    ],
                }
            ]

            with self.tasks():
                self.get_success_response(
                    self.organization.slug, staff_team.id, **self.base_data, status_code=204
                )

            self.user_one.refresh_from_db()
            assert self.user_one.is_staff

    def test_adding_to_superuser_group_dispatches_task(self) -> None:
        with override_settings(
            SENTRY_MODE=SentryMode.SAAS,
            SUPERUSER_ORG_ID=self.organization.id,
            SENTRY_SCIM_STAFF_TEAM_SLUG="snty-staff",
            SENTRY_SCIM_SUPERUSER_READ_TEAM_SLUG="snty-superuser-read",
            SENTRY_SCIM_SUPERUSER_WRITE_TEAM_SLUG="snty-superuser-write",
        ):
            superuser_team = self.create_team(
                organization=self.organization, slug="snty-superuser-read", idp_provisioned=True
            )

            assert not self.user_two.is_superuser

            self.base_data["Operations"] = [
                {
                    "op": "add",
                    "path": "members",
                    "value": [
                        {
                            "value": self.member_two.id,
                            "display": self.member_two.email,
                        }
                    ],
                }
            ]

            with self.tasks():
                self.get_success_response(
                    self.organization.slug, superuser_team.id, **self.base_data, status_code=204
                )

            self.user_two.refresh_from_db()
            assert self.user_two.is_superuser

    def test_removing_from_staff_group_dispatches_task(self) -> None:
        with override_settings(
            SENTRY_MODE=SentryMode.SAAS,
            SUPERUSER_ORG_ID=self.organization.id,
            SENTRY_SCIM_STAFF_TEAM_SLUG="snty-staff",
            SENTRY_SCIM_SUPERUSER_READ_TEAM_SLUG="snty-superuser-read",
            SENTRY_SCIM_SUPERUSER_WRITE_TEAM_SLUG="snty-superuser-write",
        ):
            staff_team = self.create_team(
                organization=self.organization, slug="snty-staff", idp_provisioned=True
            )
            staff_user = self.create_user(
                email="test_removing_from_staff_group_dispatches_task@example.com", is_staff=True
            )
            staff_member = self.create_member(user=staff_user, organization=self.organization)

            OrganizationMemberTeam.objects.create(team=staff_team, organizationmember=staff_member)

            self.base_data["Operations"] = [
                {
                    "op": "remove",
                    "path": f'members[value eq "{staff_member.id}"]',
                }
            ]

            with self.tasks():
                self.get_success_response(
                    self.organization.slug, staff_team.id, **self.base_data, status_code=204
                )

            staff_user.refresh_from_db()
            assert (
                OrganizationMemberTeam.objects.filter(
                    team=staff_team, organizationmember=staff_member
                ).exists()
                is False
            )
            assert not staff_user.is_staff

    def test_removing_from_superuser_group_dispatches_task(self) -> None:
        with override_settings(
            SENTRY_MODE=SentryMode.SAAS,
            SUPERUSER_ORG_ID=self.organization.id,
            SENTRY_SCIM_STAFF_TEAM_SLUG="snty-staff",
            SENTRY_SCIM_SUPERUSER_READ_TEAM_SLUG="snty-superuser-read",
            SENTRY_SCIM_SUPERUSER_WRITE_TEAM_SLUG="snty-superuser-write",
        ):
            superuser_team = self.create_team(
                organization=self.organization, slug="snty-superuser-read", idp_provisioned=True
            )

            superuser_user = self.create_user(
                email="test_removing_from_superuser_group_dispatches_task@example.com",
                is_superuser=True,
            )
            superuser_member = self.create_member(
                user=superuser_user, organization=self.organization
            )

            OrganizationMemberTeam.objects.create(
                team=superuser_team, organizationmember=superuser_member
            )

            self.base_data["Operations"] = [
                {
                    "op": "remove",
                    "path": f'members[value eq "{superuser_member.id}"]',
                }
            ]

            with self.tasks():
                self.get_success_response(
                    self.organization.slug, superuser_team.id, **self.base_data, status_code=204
                )

            superuser_user.refresh_from_db()
            assert (
                OrganizationMemberTeam.objects.filter(
                    team=superuser_team, organizationmember=superuser_member
                ).exists()
                is False
            )
            assert not superuser_user.is_superuser

    def test_replace_members_dispatches_task_with_grant_and_revoke(self) -> None:
        with override_settings(
            SENTRY_MODE=SentryMode.SAAS,
            SUPERUSER_ORG_ID=self.organization.id,
            SENTRY_SCIM_STAFF_TEAM_SLUG="snty-staff",
            SENTRY_SCIM_SUPERUSER_READ_TEAM_SLUG="snty-superuser-read",
            SENTRY_SCIM_SUPERUSER_WRITE_TEAM_SLUG="snty-superuser-write",
        ):
            staff_team = self.create_team(
                organization=self.organization, slug="snty-staff", idp_provisioned=True
            )

            OrganizationMemberTeam.objects.create(
                team=staff_team, organizationmember=self.member_one
            )

            self.base_data["Operations"] = [
                {
                    "op": "replace",
                    "path": "members",
                    "value": [
                        {
                            "value": self.member_two.id,
                            "display": self.member_two.email,
                        }
                    ],
                }
            ]

            with self.tasks():
                self.get_success_response(
                    self.organization.slug, staff_team.id, **self.base_data, status_code=204
                )

            # The new member gets granted staff
            self.user_two.refresh_from_db()
            assert self.user_two.is_staff

    def test_adding_to_superuser_write_group_dispatches_task(self) -> None:
        from sentry.users.models.userpermission import UserPermission

        with override_settings(
            SENTRY_MODE=SentryMode.SAAS,
            SUPERUSER_ORG_ID=self.organization.id,
            SENTRY_SCIM_STAFF_TEAM_SLUG="snty-staff",
            SENTRY_SCIM_SUPERUSER_READ_TEAM_SLUG="snty-superuser-read",
            SENTRY_SCIM_SUPERUSER_WRITE_TEAM_SLUG="snty-superuser-write",
        ):
            superuser_write_team = self.create_team(
                organization=self.organization, slug="snty-superuser-write", idp_provisioned=True
            )

            self.base_data["Operations"] = [
                {
                    "op": "add",
                    "path": "members",
                    "value": [
                        {
                            "value": self.member_one.id,
                            "display": self.member_one.email,
                        }
                    ],
                }
            ]

            with self.tasks():
                self.get_success_response(
                    self.organization.slug,
                    superuser_write_team.id,
                    **self.base_data,
                    status_code=204,
                )

            self.user_one.refresh_from_db()
            assert self.user_one.is_superuser

            with assume_test_silo_mode(SiloMode.CONTROL):
                assert UserPermission.objects.filter(
                    user_id=self.user_one.id, permission="superuser.write"
                ).exists()

    def test_removing_from_superuser_write_group_dispatches_task(self) -> None:
        from sentry.users.models.userpermission import UserPermission

        with override_settings(
            SENTRY_MODE=SentryMode.SAAS,
            SUPERUSER_ORG_ID=self.organization.id,
            SENTRY_SCIM_STAFF_TEAM_SLUG="snty-staff",
            SENTRY_SCIM_SUPERUSER_READ_TEAM_SLUG="snty-superuser-read",
            SENTRY_SCIM_SUPERUSER_WRITE_TEAM_SLUG="snty-superuser-write",
        ):
            superuser_write_team = self.create_team(
                organization=self.organization, slug="snty-superuser-write", idp_provisioned=True
            )

            su_write_user = self.create_user(email="remove_su_write@example.com", is_superuser=True)
            su_write_member = self.create_member(user=su_write_user, organization=self.organization)

            with assume_test_silo_mode(SiloMode.CONTROL):
                UserPermission.objects.create(
                    user_id=su_write_user.id, permission="superuser.write"
                )

            OrganizationMemberTeam.objects.create(
                team=superuser_write_team, organizationmember=su_write_member
            )

            self.base_data["Operations"] = [
                {
                    "op": "remove",
                    "path": f'members[value eq "{su_write_member.id}"]',
                }
            ]

            with self.tasks():
                self.get_success_response(
                    self.organization.slug,
                    superuser_write_team.id,
                    **self.base_data,
                    status_code=204,
                )

            su_write_user.refresh_from_db()
            assert not su_write_user.is_superuser

            with assume_test_silo_mode(SiloMode.CONTROL):
                assert not UserPermission.objects.filter(
                    user_id=su_write_user.id, permission="superuser.write"
                ).exists()

    def test_regular_team_does_not_dispatch_task(self) -> None:
        with override_settings(
            SENTRY_MODE=SentryMode.SAAS,
            SUPERUSER_ORG_ID=self.organization.id,
            SENTRY_SCIM_STAFF_TEAM_SLUG="snty-staff",
            SENTRY_SCIM_SUPERUSER_READ_TEAM_SLUG="snty-superuser-read",
            SENTRY_SCIM_SUPERUSER_WRITE_TEAM_SLUG="snty-superuser-write",
        ):
            regular_team = self.create_team(
                organization=self.organization, slug="engineering", idp_provisioned=True
            )

            self.base_data["Operations"] = [
                {
                    "op": "add",
                    "path": "members",
                    "value": [
                        {
                            "value": self.member_one.id,
                            "display": self.member_one.email,
                        }
                    ],
                }
            ]

            with self.tasks():
                self.get_success_response(
                    self.organization.slug, regular_team.id, **self.base_data, status_code=204
                )

            self.user_one.refresh_from_db()
            assert not self.user_one.is_staff
            assert not self.user_one.is_superuser

    def test_non_default_org_does_not_dispatch_task(self) -> None:
        with override_settings(
            SENTRY_MODE=SentryMode.SAAS,
            SUPERUSER_ORG_ID=self.organization.id,
            SENTRY_SCIM_STAFF_TEAM_SLUG="snty-staff",
            SENTRY_SCIM_SUPERUSER_READ_TEAM_SLUG="snty-superuser-read",
            SENTRY_SCIM_SUPERUSER_WRITE_TEAM_SLUG="snty-superuser-write",
        ):
            other_org = self.create_organization(name="Other Org")
            other_member = self.create_member(user=self.user_one, organization=other_org)

            with assume_test_silo_mode(SiloMode.CONTROL):
                other_auth_provider = AuthProviderModel(
                    organization_id=other_org.id, provider="dummy"
                )
                other_auth_provider.enable_scim(self.user)
                other_auth_provider.save()
                other_scim_user = ApiToken.objects.get(
                    token=other_auth_provider.get_scim_token()
                ).user

            self.login_as(user=other_scim_user)

            staff_team = self.create_team(
                organization=other_org, slug="snty-staff", idp_provisioned=True
            )

            self.base_data["Operations"] = [
                {
                    "op": "add",
                    "path": "members",
                    "value": [
                        {
                            "value": other_member.id,
                            "display": other_member.email,
                        }
                    ],
                }
            ]

            with self.tasks():
                self.get_success_response(
                    other_org.slug, staff_team.id, **self.base_data, status_code=204
                )

            self.user_one.refresh_from_db()
            assert not self.user_one.is_staff

    def test_non_saas_mode_does_not_dispatch_task(self) -> None:
        with override_settings(
            SENTRY_MODE=SentryMode.SELF_HOSTED,
            SUPERUSER_ORG_ID=self.organization.id,
            SENTRY_SCIM_STAFF_TEAM_SLUG="snty-staff",
            SENTRY_SCIM_SUPERUSER_READ_TEAM_SLUG="snty-superuser-read",
            SENTRY_SCIM_SUPERUSER_WRITE_TEAM_SLUG="snty-superuser-write",
        ):
            staff_team = self.create_team(
                organization=self.organization, slug="snty-staff", idp_provisioned=True
            )

            self.base_data["Operations"] = [
                {
                    "op": "add",
                    "path": "members",
                    "value": [
                        {
                            "value": self.member_one.id,
                            "display": self.member_one.email,
                        }
                    ],
                }
            ]

            with self.tasks():
                self.get_success_response(
                    self.organization.slug, staff_team.id, **self.base_data, status_code=204
                )

            self.user_one.refresh_from_db()
            assert not self.user_one.is_staff


class SCIMTeamDeletePrivilegeManagementTest(SCIMTestCase):
    endpoint = "sentry-api-0-organization-scim-team-details"
    method = "delete"

    def setUp(self) -> None:
        super().setUp()

        self.user_one = self.create_user(email="staff_user@example.com")
        self.member_one = self.create_member(user=self.user_one, organization=self.organization)

        self.user_two = self.create_user(email="superuser_user@example.com")
        self.member_two = self.create_member(user=self.user_two, organization=self.organization)

    def test_deleting_staff_team_dispatches_task(self) -> None:
        with override_settings(
            SENTRY_MODE=SentryMode.SAAS,
            SUPERUSER_ORG_ID=self.organization.id,
            SENTRY_SCIM_STAFF_TEAM_SLUG="snty-staff",
            SENTRY_SCIM_SUPERUSER_READ_TEAM_SLUG="snty-superuser-read",
            SENTRY_SCIM_SUPERUSER_WRITE_TEAM_SLUG="snty-superuser-write",
        ):
            staff_team = self.create_team(
                organization=self.organization, slug="snty-staff", idp_provisioned=True
            )

            staff_user_a = self.create_user(email="delete_staff_a@example.com", is_staff=True)
            staff_member_a = self.create_member(user=staff_user_a, organization=self.organization)
            staff_user_b = self.create_user(email="delete_staff_b@example.com", is_staff=True)
            staff_member_b = self.create_member(user=staff_user_b, organization=self.organization)

            OrganizationMemberTeam.objects.create(
                team=staff_team, organizationmember=staff_member_a
            )
            OrganizationMemberTeam.objects.create(
                team=staff_team, organizationmember=staff_member_b
            )

            with self.tasks():
                self.get_success_response(self.organization.slug, staff_team.id, status_code=204)

            staff_user_a.refresh_from_db()
            assert not staff_user_a.is_staff

            staff_user_b.refresh_from_db()
            assert not staff_user_b.is_staff

    def test_deleting_superuser_team_dispatches_task(self) -> None:
        with override_settings(
            SENTRY_MODE=SentryMode.SAAS,
            SUPERUSER_ORG_ID=self.organization.id,
            SENTRY_SCIM_STAFF_TEAM_SLUG="snty-staff",
            SENTRY_SCIM_SUPERUSER_READ_TEAM_SLUG="snty-superuser-read",
            SENTRY_SCIM_SUPERUSER_WRITE_TEAM_SLUG="snty-superuser-write",
        ):
            superuser_team = self.create_team(
                organization=self.organization, slug="snty-superuser-read", idp_provisioned=True
            )

            su_user = self.create_user(email="delete_superuser@example.com", is_superuser=True)
            su_member = self.create_member(user=su_user, organization=self.organization)

            OrganizationMemberTeam.objects.create(team=superuser_team, organizationmember=su_member)

            with self.tasks():
                self.get_success_response(
                    self.organization.slug, superuser_team.id, status_code=204
                )

            su_user.refresh_from_db()
            assert not su_user.is_superuser

    def test_deleting_regular_team_does_not_dispatch_task(self) -> None:
        with override_settings(
            SENTRY_MODE=SentryMode.SAAS,
            SUPERUSER_ORG_ID=self.organization.id,
            SENTRY_SCIM_STAFF_TEAM_SLUG="snty-staff",
            SENTRY_SCIM_SUPERUSER_READ_TEAM_SLUG="snty-superuser-read",
            SENTRY_SCIM_SUPERUSER_WRITE_TEAM_SLUG="snty-superuser-write",
        ):
            regular_team = self.create_team(
                organization=self.organization, slug="engineering", idp_provisioned=True
            )

            OrganizationMemberTeam.objects.create(
                team=regular_team, organizationmember=self.member_one
            )

            with self.tasks():
                self.get_success_response(self.organization.slug, regular_team.id, status_code=204)

            self.user_one.refresh_from_db()
            assert not self.user_one.is_staff
            assert not self.user_one.is_superuser
