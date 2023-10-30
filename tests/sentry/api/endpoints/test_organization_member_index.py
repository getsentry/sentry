from unittest.mock import patch

from django.core import mail

from sentry import roles
from sentry.api.endpoints.accept_organization_invite import get_invite_state
from sentry.api.endpoints.organization_member.index import OrganizationMemberSerializer
from sentry.api.invite_helper import ApiInviteHelper
from sentry.models.authenticator import Authenticator
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.useremail import UserEmail
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers import Feature, with_feature
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test


@region_silo_test(stable=True)
class OrganizationMemberSerializerTest(TestCase):
    def test_valid(self):
        context = {"organization": self.organization, "allowed_roles": [roles.get("member")]}
        data = {
            "email": "eric@localhost",
            "orgRole": "member",
            "teamRoles": [{"teamSlug": self.team.slug, "role": None}],
        }

        serializer = OrganizationMemberSerializer(context=context, data=data)
        assert serializer.is_valid()

    def test_valid_deprecated_fields(self):
        context = {"organization": self.organization, "allowed_roles": [roles.get("member")]}
        data = {"email": "eric@localhost", "role": "member", "teams": [self.team.slug]}

        serializer = OrganizationMemberSerializer(context=context, data=data)
        assert serializer.is_valid()

    def test_gets_team_objects(self):
        context = {"organization": self.organization, "allowed_roles": [roles.get("member")]}
        data = {
            "email": "eric@localhost",
            "orgRole": "member",
            "teamRoles": [{"teamSlug": self.team.slug, "role": "admin"}],
        }

        serializer = OrganizationMemberSerializer(context=context, data=data)
        assert serializer.is_valid()
        assert serializer.validated_data["teamRoles"][0] == (self.team, "admin")

    def test_gets_team_objects_with_deprecated_field(self):
        context = {"organization": self.organization, "allowed_roles": [roles.get("member")]}
        data = {"email": "eric@localhost", "orgRole": "member", "teams": [self.team.slug]}

        serializer = OrganizationMemberSerializer(context=context, data=data)
        assert serializer.is_valid()
        assert serializer.validated_data["teams"][0] == self.team

    def test_invalid_email(self):
        org = self.create_organization()
        user = self.create_user()
        member = self.create_member(organization=org, email=user.email)

        context = {"organization": org, "allowed_roles": [roles.get("member")]}
        data = {"email": user.email, "orgRole": "member", "teamRoles": []}

        serializer = OrganizationMemberSerializer(context=context, data=data)
        assert not serializer.is_valid()
        assert serializer.errors == {"email": [f"The user {user.email} is already a member"]}

        request = self.make_request(user=user)

        with assume_test_silo_mode(SiloMode.CONTROL):
            UserEmail.objects.filter(user=user, email=user.email).update(is_verified=False)

            invite_state = get_invite_state(member.id, org.slug, user.id)
            assert invite_state, "Expected invite state, logic bug?"
            invite_helper = ApiInviteHelper(
                request=request, invite_context=invite_state, token=None
            )
            invite_helper.accept_invite(user)

        serializer = OrganizationMemberSerializer(context=context, data=data)
        assert not serializer.is_valid()
        assert serializer.errors == {"email": [f"The user {user.email} is already a member"]}

    def test_invalid_team_invites(self):
        context = {"organization": self.organization, "allowed_roles": [roles.get("member")]}
        data = {"email": "eric@localhost", "orgRole": "member", "teams": ["faketeam"]}

        serializer = OrganizationMemberSerializer(context=context, data=data)

        assert not serializer.is_valid()
        assert serializer.errors == {"teams": ["Invalid teams"]}

    def test_invalid_org_role(self):
        context = {"organization": self.organization, "allowed_roles": [roles.get("member")]}
        data = {"email": "eric@localhost", "orgRole": "owner", "teamRoles": []}

        serializer = OrganizationMemberSerializer(context=context, data=data)

        assert not serializer.is_valid()
        assert serializer.errors == {
            "orgRole": ["You do not have permission to set that org-level role"]
        }

    @with_feature({"organizations:team-roles": False})
    def test_deprecated_org_role_without_flag(self):
        context = {
            "organization": self.organization,
            "allowed_roles": [roles.get("admin"), roles.get("member")],
        }
        data = {"email": "eric@localhost", "orgRole": "admin", "teamRoles": []}

        serializer = OrganizationMemberSerializer(context=context, data=data)
        assert serializer.is_valid()

    @with_feature("organizations:team-roles")
    def test_deprecated_org_role_with_flag(self):
        context = {
            "organization": self.organization,
            "allowed_roles": [roles.get("admin"), roles.get("member")],
        }
        data = {"email": "eric@localhost", "orgRole": "admin", "teamRoles": []}

        serializer = OrganizationMemberSerializer(context=context, data=data)

        assert serializer.is_valid()

    def test_invalid_team_role(self):
        context = {"organization": self.organization, "allowed_roles": [roles.get("member")]}
        data = {
            "email": "eric@localhost",
            "orgRole": "member",
            "teamRoles": [{"teamSlug": self.team.slug, "role": "no-such-team-role"}],
        }

        serializer = OrganizationMemberSerializer(context=context, data=data)

        assert not serializer.is_valid()
        assert serializer.errors == {"teamRoles": ["Invalid team-role"]}


class OrganizationMemberListTestBase(APITestCase):
    endpoint = "sentry-api-0-organization-member-index"

    def setUp(self):
        self.user2 = self.create_user("bar@localhost", username="bar")
        self.create_member(organization=self.organization, user=self.user2)
        self.external_user = self.create_external_user(self.user2, self.organization)

        self.create_user("baz@localhost", username="baz")

        self.login_as(self.user)


@region_silo_test(stable=True)
class OrganizationMemberListTest(OrganizationMemberListTestBase, HybridCloudTestMixin):
    def test_simple(self):
        response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 2
        assert response.data[0]["email"] == self.user.email
        assert response.data[1]["email"] == self.user2.email
        assert not response.data[0]["pending"]
        assert not response.data[0]["expired"]

    def test_empty_query(self):
        response = self.get_success_response(self.organization.slug, qs_params={"query": ""})

        assert len(response.data) == 2
        assert response.data[0]["email"] == self.user.email
        assert response.data[1]["email"] == self.user2.email

    def test_query(self):
        response = self.get_success_response(self.organization.slug, qs_params={"query": "bar"})

        assert len(response.data) == 1
        assert response.data[0]["email"] == self.user2.email

    def test_id_query(self):
        member = OrganizationMember.objects.create(
            email="billy@localhost", organization=self.organization
        )
        response = self.get_success_response(
            self.organization.slug, qs_params={"query": f"id:{member.id}"}
        )

        assert len(response.data) == 1
        assert response.data[0]["email"] == "billy@localhost"

    def test_user_id_query(self):
        user = self.create_user("zoo@localhost", username="zoo")
        OrganizationMember.objects.create(user_id=user.id, organization=self.organization)
        response = self.get_success_response(
            self.organization.slug, qs_params={"query": f"user.id:{user.id}"}
        )

        assert len(response.data) == 1
        assert response.data[0]["email"] == "zoo@localhost"

    def test_query_null_user(self):
        OrganizationMember.objects.create(email="billy@localhost", organization=self.organization)
        response = self.get_success_response(self.organization.slug, qs_params={"query": "bill"})

        assert len(response.data) == 1
        assert response.data[0]["email"] == "billy@localhost"

    def test_email_query(self):
        response = self.get_success_response(
            self.organization.slug, qs_params={"query": self.user.email}
        )

        assert len(response.data) == 1
        assert response.data[0]["email"] == self.user.email

    def test_user_email_email_query(self):
        self.create_useremail(self.user, "baz@localhost")
        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "email:baz@localhost"}
        )

        assert len(response.data) == 1
        assert response.data[0]["email"] == self.user.email

    def test_scope_query(self):
        response = self.get_success_response(
            self.organization.slug, qs_params={"query": 'scope:"invalid:scope"'}
        )
        assert len(response.data) == 0

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": 'scope:"org:admin"'}
        )
        assert len(response.data) == 1
        assert response.data[0]["email"] == self.user.email

    def test_role_query(self):
        member_team = self.create_team(organization=self.organization, org_role="member")
        user = self.create_user("zoo@localhost", username="zoo")
        self.create_member(
            user=user,
            organization=self.organization,
            role="owner",
            teams=[member_team],
        )
        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "role:member"}
        )
        assert len(response.data) == 2
        assert response.data[0]["email"] == self.user2.email
        assert response.data[1]["email"] == user.email

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "role:owner"}
        )
        assert len(response.data) == 2
        assert response.data[0]["email"] == self.user.email
        assert response.data[1]["email"] == user.email

    def test_is_invited_query(self):
        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "isInvited:true"}
        )
        assert len(response.data) == 0

        invited_member = self.create_member(
            organization=self.organization,
            email="invited-member@example.com",
            invite_status=InviteStatus.APPROVED.value,
        )

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "isInvited:true"}
        )
        assert len(response.data) == 1
        assert response.data[0]["email"] == invited_member.email

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "isInvited:false"}
        )
        assert len(response.data) == 2

    def test_sso_linked_query(self):
        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "ssoLinked:true"}
        )
        assert len(response.data) == 0

        user = self.create_user("morty@localhost", username="morty")
        sso_member = self.create_member(
            organization=self.organization,
            user=user,
            invite_status=InviteStatus.APPROVED.value,
            flags=OrganizationMember.flags["sso:linked"],
        )

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "ssoLinked:true"}
        )
        assert len(response.data) == 1
        assert sso_member.email is None
        assert response.data[0]["name"] == response.data[0]["user"]["email"] == user.email

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "ssoLinked:false"}
        )
        assert len(response.data) == 2

    def test_2fa_enabled_query(self):
        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "has2fa:true"}
        )
        assert len(response.data) == 0

        user = self.create_user("morty@localhost", username="morty")
        member_2fa = self.create_member(
            organization=self.organization,
            user=user,
            invite_status=InviteStatus.APPROVED.value,
        )

        # Two authenticators to ensure the user list is distinct
        with assume_test_silo_mode(SiloMode.CONTROL):
            Authenticator.objects.create(user_id=member_2fa.user_id, type=1)
            Authenticator.objects.create(user_id=member_2fa.user_id, type=2)

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "has2fa:true"}
        )
        assert len(response.data) == 1
        assert member_2fa.email is None
        assert response.data[0]["name"] == response.data[0]["user"]["email"] == user.email

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "has2fa:false"}
        )
        assert len(response.data) == 2

    def test_has_external_users_query(self):
        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "hasExternalUsers:true"}
        )
        assert len(response.data) == 1
        assert response.data[0]["email"] == self.user2.email

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "hasExternalUsers:false"}
        )
        assert len(response.data) == 1
        assert response.data[0]["email"] == self.user.email

    def test_cannot_get_unapproved_invites(self):
        join_request = "test@email.com"
        invite_request = "test@gmail.com"

        self.create_member(
            organization=self.organization,
            email=join_request,
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
        )

        self.create_member(
            organization=self.organization,
            email=invite_request,
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )

        response = self.get_success_response(self.organization.slug)
        assert len(response.data) == 2
        assert response.data[0]["email"] == self.user.email
        assert response.data[1]["email"] == self.user2.email

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": f"email:{join_request}"}
        )
        assert response.data == []

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": f"email:{invite_request}"}
        )
        assert response.data == []

    def test_owner_invites(self):
        data = {"email": "eric@localhost", "role": "owner", "teams": [self.team.slug]}
        response = self.get_success_response(self.organization.slug, method="post", **data)
        assert response.data["email"] == "eric@localhost"

    def test_valid_for_invites(self):
        data = {"email": "foo@example.com", "role": "manager", "teams": [self.team.slug]}
        with self.settings(SENTRY_ENABLE_INVITES=True), self.tasks():
            self.get_success_response(self.organization.slug, method="post", **data)

        member = OrganizationMember.objects.get(
            organization=self.organization, email="foo@example.com"
        )

        assert member.user_id is None
        assert member.role == "manager"
        self.assert_org_member_mapping(org_member=member)

        om_teams = OrganizationMemberTeam.objects.filter(organizationmember=member.id)

        assert len(om_teams) == 1
        assert om_teams[0].team_id == self.team.id

        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ["foo@example.com"]
        assert mail.outbox[0].subject == f"Join {self.organization.name} in using Sentry"

    def test_existing_user_for_invite(self):
        user = self.create_user("foobar@example.com")
        member = OrganizationMember.objects.create(
            organization=self.organization, user_id=user.id, role="member"
        )

        data = {"email": user.email, "role": "member", "teams": [self.team.slug]}
        with self.settings(SENTRY_ENABLE_INVITES=True):
            self.get_error_response(self.organization.slug, method="post", **data, status_code=400)

        member = OrganizationMember.objects.get(id=member.id)
        assert member.email is None
        assert member.role == "member"

    def test_can_invite_with_invites_to_other_orgs(self):
        email = "test@gmail.com"
        org = self.create_organization(slug="diff-org")
        OrganizationMember.objects.create(email=email, organization=org)

        data = {"email": email, "role": "member", "teams": [self.team.slug]}
        with self.settings(SENTRY_ENABLE_INVITES=True), self.tasks():
            self.get_success_response(self.organization.slug, method="post", **data)

        member = OrganizationMember.objects.get(organization=self.organization, email=email)
        assert len(mail.outbox) == 1
        assert member.role == "member"
        self.assert_org_member_mapping(org_member=member)

    def test_valid_for_direct_add(self):
        user = self.create_user("baz@example.com")

        data = {"email": user.email, "role": "member", "teams": [self.team.slug]}
        with self.settings(SENTRY_ENABLE_INVITES=False):
            self.get_success_response(self.organization.slug, method="post", **data)

        member = OrganizationMember.objects.get(organization=self.organization, email=user.email)
        assert len(mail.outbox) == 0
        assert member.role == "member"
        self.assert_org_member_mapping(org_member=member)

    def test_invalid_user_for_direct_add(self):
        data = {"email": "notexisting@example.com", "role": "manager", "teams": [self.team.slug]}
        with self.settings(SENTRY_ENABLE_INVITES=False):
            self.get_success_response(self.organization.slug, method="post", **data)

        member = OrganizationMember.objects.get(
            organization=self.organization, email="notexisting@example.com"
        )
        assert len(mail.outbox) == 0
        assert member.role == "manager"
        self.assert_org_member_mapping(org_member=member)


@region_silo_test(stable=True)
class OrganizationMemberPermissionRoleTest(OrganizationMemberListTestBase, HybridCloudTestMixin):
    method = "post"

    def test_manager_invites(self):
        manager_user = self.create_user("manager@localhost")
        self.manager = self.create_member(
            user=manager_user, organization=self.organization, role="manager"
        )
        self.login_as(user=manager_user)

        data = {"email": "eric@localhost", "role": "owner", "teams": [self.team.slug]}
        self.get_error_response(self.organization.slug, **data, status_code=400)

        data = {"email": "eric@localhost", "role": "manager", "teams": [self.team.slug]}
        self.get_success_response(self.organization.slug, **data)

        data = {"email": "eric@localhost", "role": "member", "teams": [self.team.slug]}
        self.get_error_response(self.organization.slug, **data, status_code=400)

    def test_admin_invites(self):
        admin_user = self.create_user("admin22@localhost")
        self.create_member(user=admin_user, organization=self.organization, role="admin")
        self.login_as(user=admin_user)

        data = {"email": "eric@localhost", "role": "owner", "teams": [self.team.slug]}
        self.get_error_response(self.organization.slug, **data, status_code=403)

        data = {"email": "eric@localhost", "role": "manager", "teams": [self.team.slug]}
        self.get_error_response(self.organization.slug, **data, status_code=403)

        data = {"email": "eric@localhost", "role": "member", "teams": [self.team.slug]}
        self.get_error_response(self.organization.slug, **data, status_code=403)

    def test_member_invites(self):
        member_user = self.create_user("member@localhost")
        self.create_member(user=member_user, organization=self.organization, role="member")
        self.login_as(user=member_user)

        data = {"email": "eric@localhost", "role": "owner", "teams": [self.team.slug]}
        self.get_error_response(self.organization.slug, **data, status_code=403)

        data = {"email": "eric@localhost", "role": "manager", "teams": [self.team.slug]}
        self.get_error_response(self.organization.slug, **data, status_code=403)

        data = {"email": "eric@localhost", "role": "member", "teams": [self.team.slug]}
        self.get_error_response(self.organization.slug, **data, status_code=403)

    def test_respects_feature_flag(self):
        user = self.create_user("baz@example.com")

        with Feature({"organizations:invite-members": False}):
            data = {"email": user.email, "role": "member", "teams": [self.team.slug]}
            self.get_error_response(self.organization.slug, **data, status_code=403)

    def test_no_team_invites(self):
        data = {"email": "eric@localhost", "role": "owner", "teams": []}
        response = self.get_success_response(self.organization.slug, **data)
        assert response.data["email"] == "eric@localhost"

    def test_can_invite_member_with_pending_invite_request(self):
        email = "test@gmail.com"

        invite_request = OrganizationMember.objects.create(
            email=email,
            organization=self.organization,
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )

        data = {"email": email, "role": "member", "teams": [self.team.slug]}
        with self.settings(SENTRY_ENABLE_INVITES=True), self.tasks():
            self.get_success_response(self.organization.slug, **data)

        assert not OrganizationMember.objects.filter(id=invite_request.id).exists()
        org_member = OrganizationMember.objects.filter(
            organization=self.organization, email=email
        ).get()
        self.assert_org_member_mapping(org_member=org_member)
        assert len(mail.outbox) == 1

    def test_can_invite_member_with_pending_join_request(self):
        email = "test@gmail.com"
        join_request = self.create_member(
            email=email,
            organization=self.organization,
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
        )
        self.assert_org_member_mapping(org_member=join_request)

        data = {"email": email, "role": "member", "teams": [self.team.slug]}
        with self.settings(SENTRY_ENABLE_INVITES=True), self.tasks(), outbox_runner():
            self.get_success_response(self.organization.slug, **data)

        assert not OrganizationMember.objects.filter(id=join_request.id).exists()
        self.assert_org_member_mapping_not_exists(org_member=join_request)
        org_member = OrganizationMember.objects.filter(
            organization=self.organization, email=email
        ).get()
        self.assert_org_member_mapping(org_member=org_member)
        assert len(mail.outbox) == 1

    def test_user_has_external_user_association(self):
        response = self.get_success_response(
            self.organization.slug, method="get", qs_params={"expand": "externalUsers"}
        )
        assert len(response.data) == 2
        organization_member = next(
            filter(lambda x: x["user"]["id"] == str(self.user2.id), response.data)
        )
        assert organization_member
        assert len(organization_member["externalUsers"]) == 1
        assert organization_member["externalUsers"][0]["id"] == str(self.external_user.id)
        assert (
            organization_member["externalUsers"][0]["userId"] == organization_member["user"]["id"]
        )

    def test_user_has_external_user_associations_across_multiple_orgs(self):
        organization = self.create_organization(owner=self.user2)
        integration = self.create_integration(
            organization=self.organization, external_id="github:2", name="GitHub", provider="github"
        )
        self.create_external_user(self.user2, organization, integration=integration)

        response = self.get_success_response(
            self.organization.slug, method="get", qs_params={"expand": "externalUsers"}
        )
        assert len(response.data) == 2
        organization_member = next(
            filter(lambda x: x["user"]["id"] == str(self.user2.id), response.data)
        )
        assert organization_member
        assert len(organization_member["externalUsers"]) == 1
        assert organization_member["externalUsers"][0]["id"] == str(self.external_user.id)
        assert (
            organization_member["externalUsers"][0]["userId"] == organization_member["user"]["id"]
        )


@region_silo_test(stable=True)
class OrganizationMemberListPostTest(OrganizationMemberListTestBase, HybridCloudTestMixin):
    method = "post"

    def test_forbid_qq(self):
        data = {"email": "1234@qq.com", "role": "member", "teams": [self.team.slug]}
        response = self.get_error_response(self.organization.slug, **data, status_code=400)
        assert response.data["email"][0] == "Enter a valid email address."

    @patch.object(OrganizationMember, "send_invite_email")
    def test_simple(self, mock_send_invite_email):
        data = {"email": "jane@gmail.com", "role": "member", "teams": [self.team.slug]}
        response = self.get_success_response(self.organization.slug, **data)

        om = OrganizationMember.objects.get(id=response.data["id"])
        assert om.user_id is None
        assert om.email == "jane@gmail.com"
        assert om.role == "member"
        assert list(om.teams.all()) == [self.team]
        assert om.inviter_id == self.user.id
        self.assert_org_member_mapping(org_member=om)

        mock_send_invite_email.assert_called_once()

    def test_no_teams(self):
        data = {"email": "jane@gmail.com", "role": "member"}
        response = self.get_success_response(self.organization.slug, **data)

        om = OrganizationMember.objects.get(id=response.data["id"])
        assert om.user_id is None
        assert om.email == "jane@gmail.com"
        assert om.role == "member"
        assert list(om.teams.all()) == []
        assert om.inviter_id == self.user.id
        self.assert_org_member_mapping(org_member=om)

    @patch.object(OrganizationMember, "send_invite_email")
    def test_no_email(self, mock_send_invite_email):
        data = {
            "email": "jane@gmail.com",
            "role": "member",
            "teams": [self.team.slug],
            "sendInvite": False,
        }
        response = self.get_success_response(self.organization.slug, **data)
        om = OrganizationMember.objects.get(id=response.data["id"])
        assert om.user_id is None
        assert om.email == "jane@gmail.com"
        assert om.role == "member"
        assert list(om.teams.all()) == [self.team]
        assert om.inviter_id == self.user.id
        self.assert_org_member_mapping(org_member=om)

        assert not mock_send_invite_email.mock_calls

    @patch.object(OrganizationMember, "send_invite_email")
    def test_referrer_param(self, mock_send_invite_email):
        data = {
            "email": "jane@gmail.com",
            "role": "member",
            "teams": [self.team.slug],
        }
        response = self.get_success_response(
            self.organization.slug, **data, qs_params={"referrer": "test_referrer"}
        )

        om = OrganizationMember.objects.get(id=response.data["id"])
        assert om.user_id is None
        assert om.email == "jane@gmail.com"
        assert om.role == "member"
        assert list(om.teams.all()) == [self.team]
        assert om.inviter_id == self.user.id
        self.assert_org_member_mapping(org_member=om)

        mock_send_invite_email.assert_called_with("test_referrer")

    @patch("sentry.ratelimits.for_organization_member_invite")
    def test_rate_limited(self, mock_rate_limit):
        mock_rate_limit.return_value = True

        data = {"email": "jane@gmail.com", "role": "member"}
        self.get_error_response(self.organization.slug, **data, status_code=429)
        assert not OrganizationMember.objects.filter(email="jane@gmail.com").exists()
