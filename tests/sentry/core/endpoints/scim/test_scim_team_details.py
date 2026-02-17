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
from sentry.testutils.silo import assume_test_silo_mode
from sentry.users.services.user.service import user_service


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

    def test_adding_to_staff_group_grants_is_staff(self) -> None:
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

            user = user_service.get_user(user_id=self.user_one.id)
            assert user is not None
            assert not user.is_staff

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

            self.get_success_response(
                self.organization.slug, staff_team.id, **self.base_data, status_code=204
            )

            # Verify is_staff was granted
            user = user_service.get_user(user_id=self.user_one.id)
            assert user is not None
            assert user.is_staff

    def test_adding_to_superuser_group_grants_is_superuser(self) -> None:
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

            user = user_service.get_user(user_id=self.user_two.id)
            assert user is not None
            assert not user.is_superuser

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

            self.get_success_response(
                self.organization.slug, superuser_team.id, **self.base_data, status_code=204
            )

            # Verify is_superuser was granted
            user = user_service.get_user(user_id=self.user_two.id)
            assert user is not None
            assert user.is_superuser

    def test_removing_from_staff_group_revokes_only_is_staff(self) -> None:
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

            user_service.update_user(
                user_id=self.user_one.id, attrs={"is_staff": True, "is_superuser": True}
            )
            OrganizationMemberTeam.objects.create(
                team=staff_team, organizationmember=self.member_one
            )

            user = user_service.get_user(user_id=self.user_one.id)
            assert user is not None
            assert user.is_staff
            assert user.is_superuser

            self.base_data["Operations"] = [
                {
                    "op": "remove",
                    "path": f'members[value eq "{self.member_one.id}"]',
                }
            ]

            self.get_success_response(
                self.organization.slug, staff_team.id, **self.base_data, status_code=204
            )

            user = user_service.get_user(user_id=self.user_one.id)
            assert user is not None
            assert not user.is_staff
            assert user.is_superuser

    def test_removing_from_superuser_group_revokes_only_is_superuser(self) -> None:
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

            user_service.update_user(
                user_id=self.user_one.id, attrs={"is_staff": True, "is_superuser": True}
            )
            OrganizationMemberTeam.objects.create(
                team=superuser_team, organizationmember=self.member_one
            )

            user = user_service.get_user(user_id=self.user_one.id)
            assert user is not None
            assert user.is_staff
            assert user.is_superuser

            self.base_data["Operations"] = [
                {
                    "op": "remove",
                    "path": f'members[value eq "{self.member_one.id}"]',
                }
            ]

            self.get_success_response(
                self.organization.slug, superuser_team.id, **self.base_data, status_code=204
            )

            user = user_service.get_user(user_id=self.user_one.id)
            assert user is not None
            assert user.is_staff
            assert not user.is_superuser

    def test_replace_members_revokes_privileges_for_removed_members(self) -> None:
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

            user_service.update_user(user_id=self.user_one.id, attrs={"is_staff": True})
            OrganizationMemberTeam.objects.create(
                team=staff_team, organizationmember=self.member_one
            )

            user_one = user_service.get_user(user_id=self.user_one.id)
            assert user_one is not None
            assert user_one.is_staff

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

            self.get_success_response(
                self.organization.slug, staff_team.id, **self.base_data, status_code=204
            )

            user_one = user_service.get_user(user_id=self.user_one.id)
            assert user_one is not None
            assert not user_one.is_staff
            assert not user_one.is_superuser
            user_two = user_service.get_user(user_id=self.user_two.id)
            assert user_two is not None
            assert user_two.is_staff

    def test_regular_team_does_not_affect_privileges(self) -> None:
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

            user = user_service.get_user(user_id=self.user_one.id)
            assert user is not None
            assert not user.is_staff
            assert not user.is_superuser

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

            self.get_success_response(
                self.organization.slug, regular_team.id, **self.base_data, status_code=204
            )

            user = user_service.get_user(user_id=self.user_one.id)
            assert user is not None
            assert not user.is_staff
            assert not user.is_superuser

    def test_non_default_org_does_not_grant_privileges(self) -> None:
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

            user = user_service.get_user(user_id=self.user_one.id)
            assert user is not None
            assert not user.is_staff

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

            self.get_success_response(
                other_org.slug, staff_team.id, **self.base_data, status_code=204
            )

            user = user_service.get_user(user_id=self.user_one.id)
            assert user is not None
            assert not user.is_staff

    def test_non_saas_mode_does_not_grant_privileges(self) -> None:
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

            user = user_service.get_user(user_id=self.user_one.id)
            assert user is not None
            assert not user.is_staff

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

            self.get_success_response(
                self.organization.slug, staff_team.id, **self.base_data, status_code=204
            )

            user = user_service.get_user(user_id=self.user_one.id)
            assert user is not None
            assert not user.is_staff

    def test_privilege_grant_failure_returns_500(self) -> None:
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

            # Mock user_service.update_user to raise an exception
            with patch("sentry.core.endpoints.scim.teams.user_service.update_user") as mock_update:
                mock_update.side_effect = Exception("RPC failure")

                response = self.get_error_response(
                    self.organization.slug,
                    staff_team.id,
                    **self.base_data,
                    status_code=500,
                )

                assert response.data["detail"] == "Failed to grant user privileges"

    def test_privilege_revocation_failure_returns_500(self) -> None:
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

            # Set up user with privileges
            user_service.update_user(user_id=self.user_one.id, attrs={"is_staff": True})
            OrganizationMemberTeam.objects.create(
                team=staff_team, organizationmember=self.member_one
            )

            self.base_data["Operations"] = [
                {
                    "op": "remove",
                    "path": f'members[value eq "{self.member_one.id}"]',
                }
            ]

            # Mock user_service.update_user to raise an exception
            with patch("sentry.core.endpoints.scim.teams.user_service.update_user") as mock_update:
                mock_update.side_effect = Exception("RPC failure")

                response = self.get_error_response(
                    self.organization.slug,
                    staff_team.id,
                    **self.base_data,
                    status_code=500,
                )

                assert response.data["detail"] == "Failed to revoke user privileges"

    def test_superuser_write_grant_failure_rolls_back_permission(self) -> None:
        """Test that if update_user fails, add_permission is rolled back for snty-superuser-write."""
        with override_settings(
            SENTRY_MODE=SentryMode.SAAS,
            SUPERUSER_ORG_ID=self.organization.id,
            SENTRY_SCIM_STAFF_TEAM_SLUG="snty-staff",
            SENTRY_SCIM_SUPERUSER_READ_TEAM_SLUG="snty-superuser-read",
            SENTRY_SCIM_SUPERUSER_WRITE_TEAM_SLUG="snty-superuser-write",
        ):
            from sentry.users.models.userpermission import UserPermission

            superuser_write_team = self.create_team(
                organization=self.organization, slug="snty-superuser-write", idp_provisioned=True
            )

            # Verify user doesn't have permission initially
            with assume_test_silo_mode(SiloMode.CONTROL):
                assert not UserPermission.objects.filter(
                    user_id=self.user_one.id, permission="superuser.write"
                ).exists()

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

            # Mock update_user to fail AFTER add_permission succeeds
            with patch("sentry.core.endpoints.scim.teams.user_service.update_user") as mock_update:
                mock_update.side_effect = Exception("RPC failure")

                response = self.get_error_response(
                    self.organization.slug,
                    superuser_write_team.id,
                    **self.base_data,
                    status_code=500,
                )

                assert response.data["detail"] == "Failed to grant user privileges"

            # Verify permission was rolled back - should not exist
            with assume_test_silo_mode(SiloMode.CONTROL):
                assert not UserPermission.objects.filter(
                    user_id=self.user_one.id, permission="superuser.write"
                ).exists()

    def test_adding_to_superuser_write_group_grants_is_superuser_and_permission(self) -> None:
        with override_settings(
            SENTRY_MODE=SentryMode.SAAS,
            SUPERUSER_ORG_ID=self.organization.id,
            SENTRY_SCIM_STAFF_TEAM_SLUG="snty-staff",
            SENTRY_SCIM_SUPERUSER_READ_TEAM_SLUG="snty-superuser-read",
            SENTRY_SCIM_SUPERUSER_WRITE_TEAM_SLUG="snty-superuser-write",
        ):
            from sentry.users.models.userpermission import UserPermission

            superuser_write_team = self.create_team(
                organization=self.organization, slug="snty-superuser-write", idp_provisioned=True
            )

            user = user_service.get_user(user_id=self.user_one.id)
            assert user is not None
            assert not user.is_superuser

            # Verify user doesn't have superuser.write permission
            with assume_test_silo_mode(SiloMode.CONTROL):
                assert not UserPermission.objects.filter(
                    user_id=self.user_one.id, permission="superuser.write"
                ).exists()

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

            self.get_success_response(
                self.organization.slug, superuser_write_team.id, **self.base_data, status_code=204
            )

            # Verify is_superuser was granted
            user = user_service.get_user(user_id=self.user_one.id)
            assert user is not None
            assert user.is_superuser

            # Verify superuser.write permission was granted
            with assume_test_silo_mode(SiloMode.CONTROL):
                assert UserPermission.objects.filter(
                    user_id=self.user_one.id, permission="superuser.write"
                ).exists()

    def test_removing_from_superuser_write_group_revokes_is_superuser_and_permission(self) -> None:
        with override_settings(
            SENTRY_MODE=SentryMode.SAAS,
            SUPERUSER_ORG_ID=self.organization.id,
            SENTRY_SCIM_STAFF_TEAM_SLUG="snty-staff",
            SENTRY_SCIM_SUPERUSER_READ_TEAM_SLUG="snty-superuser-read",
            SENTRY_SCIM_SUPERUSER_WRITE_TEAM_SLUG="snty-superuser-write",
        ):
            from sentry.users.models.userpermission import UserPermission

            superuser_write_team = self.create_team(
                organization=self.organization, slug="snty-superuser-write", idp_provisioned=True
            )

            # Grant user is_superuser and is_staff and add permission
            user_service.update_user(
                user_id=self.user_one.id, attrs={"is_staff": True, "is_superuser": True}
            )
            with assume_test_silo_mode(SiloMode.CONTROL):
                UserPermission.objects.create(
                    user_id=self.user_one.id, permission="superuser.write"
                )
            OrganizationMemberTeam.objects.create(
                team=superuser_write_team, organizationmember=self.member_one
            )

            user = user_service.get_user(user_id=self.user_one.id)
            assert user is not None
            assert user.is_staff
            assert user.is_superuser
            with assume_test_silo_mode(SiloMode.CONTROL):
                assert UserPermission.objects.filter(
                    user_id=self.user_one.id, permission="superuser.write"
                ).exists()

            self.base_data["Operations"] = [
                {
                    "op": "remove",
                    "path": f'members[value eq "{self.member_one.id}"]',
                }
            ]

            self.get_success_response(
                self.organization.slug, superuser_write_team.id, **self.base_data, status_code=204
            )

            # Verify is_superuser was revoked but is_staff retained
            user = user_service.get_user(user_id=self.user_one.id)
            assert user is not None
            assert user.is_staff  # Should still have staff
            assert not user.is_superuser

            # Verify superuser.write permission was revoked
            with assume_test_silo_mode(SiloMode.CONTROL):
                assert not UserPermission.objects.filter(
                    user_id=self.user_one.id, permission="superuser.write"
                ).exists()

    def test_superuser_write_revoke_failure_keeps_permission_removed(self) -> None:
        """Test that if update_user fails, permission stays removed (fail-secure) for snty-superuser-write."""
        with override_settings(
            SENTRY_MODE=SentryMode.SAAS,
            SUPERUSER_ORG_ID=self.organization.id,
            SENTRY_SCIM_STAFF_TEAM_SLUG="snty-staff",
            SENTRY_SCIM_SUPERUSER_READ_TEAM_SLUG="snty-superuser-read",
            SENTRY_SCIM_SUPERUSER_WRITE_TEAM_SLUG="snty-superuser-write",
        ):
            from sentry.users.models.userpermission import UserPermission

            superuser_write_team = self.create_team(
                organization=self.organization, slug="snty-superuser-write", idp_provisioned=True
            )

            # Set up user with privileges and permission
            user_service.update_user(
                user_id=self.user_one.id, attrs={"is_staff": True, "is_superuser": True}
            )
            with assume_test_silo_mode(SiloMode.CONTROL):
                UserPermission.objects.create(
                    user_id=self.user_one.id, permission="superuser.write"
                )
            OrganizationMemberTeam.objects.create(
                team=superuser_write_team, organizationmember=self.member_one
            )

            # Verify permission exists initially
            with assume_test_silo_mode(SiloMode.CONTROL):
                assert UserPermission.objects.filter(
                    user_id=self.user_one.id, permission="superuser.write"
                ).exists()

            self.base_data["Operations"] = [
                {
                    "op": "remove",
                    "path": f'members[value eq "{self.member_one.id}"]',
                }
            ]

            # Mock update_user to fail AFTER remove_permission succeeds
            with patch("sentry.core.endpoints.scim.teams.user_service.update_user") as mock_update:
                mock_update.side_effect = Exception("RPC failure")

                response = self.get_error_response(
                    self.organization.slug,
                    superuser_write_team.id,
                    **self.base_data,
                    status_code=500,
                )

                assert response.data["detail"] == "Failed to revoke user privileges"

            # Verify permission was NOT rolled back - safer to keep it removed
            with assume_test_silo_mode(SiloMode.CONTROL):
                assert not UserPermission.objects.filter(
                    user_id=self.user_one.id, permission="superuser.write"
                ).exists()


class SCIMTeamDeletePrivilegeManagementTest(SCIMTestCase):
    endpoint = "sentry-api-0-organization-scim-team-details"
    method = "delete"

    def setUp(self) -> None:
        super().setUp()

        self.user_one = self.create_user(email="staff_user@example.com")
        self.member_one = self.create_member(user=self.user_one, organization=self.organization)

        self.user_two = self.create_user(email="superuser_user@example.com")
        self.member_two = self.create_member(user=self.user_two, organization=self.organization)

    def test_deleting_staff_team_revokes_privileges(self) -> None:
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

            # Add two members to the team and grant them is_staff
            user_service.update_user(
                user_id=self.user_one.id, attrs={"is_staff": True, "is_superuser": True}
            )
            user_service.update_user(user_id=self.user_two.id, attrs={"is_staff": True})
            OrganizationMemberTeam.objects.create(
                team=staff_team, organizationmember=self.member_one
            )
            OrganizationMemberTeam.objects.create(
                team=staff_team, organizationmember=self.member_two
            )

            # Verify users have is_staff
            user_one = user_service.get_user(user_id=self.user_one.id)
            assert user_one is not None
            assert user_one.is_staff
            user_two = user_service.get_user(user_id=self.user_two.id)
            assert user_two is not None
            assert user_two.is_staff

            # Delete the team
            self.get_success_response(self.organization.slug, staff_team.id, status_code=204)

            # Verify is_staff was revoked from both users, but is_superuser retained
            user_one = user_service.get_user(user_id=self.user_one.id)
            assert user_one is not None
            assert not user_one.is_staff
            assert user_one.is_superuser  # Should still have superuser
            user_two = user_service.get_user(user_id=self.user_two.id)
            assert user_two is not None
            assert not user_two.is_staff

    def test_deleting_superuser_team_revokes_privileges(self) -> None:
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

            # Add member to the team and grant is_superuser
            user_service.update_user(
                user_id=self.user_one.id, attrs={"is_staff": True, "is_superuser": True}
            )
            OrganizationMemberTeam.objects.create(
                team=superuser_team, organizationmember=self.member_one
            )

            # Verify user has is_superuser
            user = user_service.get_user(user_id=self.user_one.id)
            assert user is not None
            assert user.is_superuser

            # Delete the team
            self.get_success_response(self.organization.slug, superuser_team.id, status_code=204)

            # Verify is_superuser was revoked but is_staff retained
            user = user_service.get_user(user_id=self.user_one.id)
            assert user is not None
            assert user.is_staff  # Should still have staff
            assert not user.is_superuser

    def test_deleting_regular_team_does_not_affect_privileges(self) -> None:
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

            # Add member with privileges
            user_service.update_user(
                user_id=self.user_one.id, attrs={"is_staff": True, "is_superuser": True}
            )
            OrganizationMemberTeam.objects.create(
                team=regular_team, organizationmember=self.member_one
            )

            # Delete the team
            self.get_success_response(self.organization.slug, regular_team.id, status_code=204)

            # Verify privileges were not affected
            user = user_service.get_user(user_id=self.user_one.id)
            assert user is not None
            assert user.is_staff
            assert user.is_superuser

    def test_deleting_team_with_privilege_revocation_failure_returns_500(self) -> None:
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

            # Add member to the team
            user_service.update_user(user_id=self.user_one.id, attrs={"is_staff": True})
            OrganizationMemberTeam.objects.create(
                team=staff_team, organizationmember=self.member_one
            )

            # Mock user_service.update_user to raise an exception
            with patch("sentry.core.endpoints.scim.teams.user_service.update_user") as mock_update:
                mock_update.side_effect = Exception("RPC failure")

                response = self.get_error_response(
                    self.organization.slug,
                    staff_team.id,
                    status_code=500,
                )

                assert response.data["detail"] == "Failed to revoke user privileges"
