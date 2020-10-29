from __future__ import absolute_import

from sentry.utils.compat.mock import patch

from django.core.urlresolvers import reverse
from django.core import mail

from sentry import roles
from sentry.api.endpoints.organization_member_index import OrganizationMemberSerializer
from sentry.testutils import APITestCase, TestCase
from sentry.models import InviteStatus, OrganizationMember, OrganizationMemberTeam, Authenticator
from sentry.testutils.helpers import Feature


class OrganizationMemberSerializerTest(TestCase):
    def test_valid(self):
        context = {"organization": self.organization, "allowed_roles": [roles.get("member")]}
        data = {"email": "eric@localhost", "role": "member", "teams": [self.team.slug]}

        serializer = OrganizationMemberSerializer(context=context, data=data)
        assert serializer.is_valid()

    def test_gets_teams_objects(self):
        context = {"organization": self.organization, "allowed_roles": [roles.get("member")]}
        data = {"email": "eric@localhost", "role": "member", "teams": [self.team.slug]}

        serializer = OrganizationMemberSerializer(context=context, data=data)
        assert serializer.is_valid()
        assert serializer.validated_data["teams"][0] == self.team

    def test_invalid_email(self):
        context = {"organization": self.organization, "allowed_roles": [roles.get("member")]}
        data = {"email": self.user.email, "role": "member", "teams": []}

        serializer = OrganizationMemberSerializer(context=context, data=data)
        assert not serializer.is_valid()
        assert serializer.errors == {
            "email": ["The user %s is already a member" % (self.user.email,)]
        }

    def test_invalid_team_invites(self):
        context = {"organization": self.organization, "allowed_roles": [roles.get("member")]}
        data = {"email": "eric@localhost", "role": "member", "teams": ["faketeam"]}

        serializer = OrganizationMemberSerializer(context=context, data=data)

        assert not serializer.is_valid()
        assert serializer.errors == {"teams": ["Invalid teams"]}

    def test_invalid_role(self):
        context = {"organization": self.organization, "allowed_roles": [roles.get("member")]}
        data = {"email": "eric@localhost", "role": "owner", "teams": []}

        serializer = OrganizationMemberSerializer(context=context, data=data)

        assert not serializer.is_valid()
        assert serializer.errors == {"role": ["You do not have permission to invite that role."]}


class OrganizationMemberListTest(APITestCase):
    def setUp(self):
        self.owner_user = self.create_user("foo@localhost", username="foo")
        self.user_2 = self.create_user("bar@localhost", username="bar")
        self.create_user("baz@localhost", username="baz")

        self.org = self.create_organization(owner=self.owner_user)
        self.org.member_set.create(user=self.user_2)
        self.team = self.create_team(organization=self.org)

        self.login_as(user=self.owner_user)

        self.url = reverse(
            "sentry-api-0-organization-member-index", kwargs={"organization_slug": self.org.slug}
        )

    def test_simple(self):
        response = self.client.get(self.url)

        assert response.status_code == 200
        assert len(response.data) == 2
        assert response.data[0]["email"] == self.user_2.email
        assert response.data[1]["email"] == self.owner_user.email
        assert response.data[0]["pending"] is False
        assert response.data[0]["expired"] is False

    def test_empty_query(self):
        response = self.client.get(self.url + "?query=")

        assert response.status_code == 200
        assert len(response.data) == 2
        assert response.data[0]["email"] == self.user_2.email
        assert response.data[1]["email"] == self.owner_user.email

    def test_query(self):
        response = self.client.get(self.url + "?query=bar")

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["email"] == "bar@localhost"

    def test_query_null_user(self):
        OrganizationMember.objects.create(email="billy@localhost", organization=self.org)
        response = self.client.get(self.url + "?query=bill")

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["email"] == "billy@localhost"

    def test_email_query(self):
        response = self.client.get(self.url + "?query=email:foo@localhost")

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["email"] == self.owner_user.email

    def test_user_email_email_query(self):
        self.create_useremail(self.owner_user, "baz@localhost")
        response = self.client.get(self.url + "?query=email:baz@localhost")

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["email"] == self.owner_user.email

    def test_scope_query(self):
        response = self.client.get(self.url + '?query=scope:"invalid:scope"')

        assert response.status_code == 200
        assert len(response.data) == 0

        response = self.client.get(self.url + '?query=scope:"org:admin"')

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["email"] == self.owner_user.email

    def test_role_query(self):
        response = self.client.get(self.url + "?query=role:member")

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["email"] == self.user_2.email

        response = self.client.get(self.url + "?query=role:owner")

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["email"] == self.owner_user.email

    def test_is_invited_query(self):
        response = self.client.get(self.url + "?query=isInvited:true")
        assert response.status_code == 200
        assert len(response.data) == 0

        invited_member = self.create_member(
            organization=self.org,
            email="invited-member@example.com",
            invite_status=InviteStatus.APPROVED.value,
        )

        response = self.client.get(self.url + "?query=isInvited:true")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["email"] == invited_member.email

        response = self.client.get(self.url + "?query=isInvited:false")
        assert response.status_code == 200
        assert len(response.data) == 2

    def test_sso_linked_query(self):
        response = self.client.get(self.url + "?query=ssoLinked:true")
        assert response.status_code == 200
        assert len(response.data) == 0

        user = self.create_user("morty@localhost", username="morty")
        sso_member = self.create_member(
            organization=self.org,
            user=user,
            email=user.email,
            invite_status=InviteStatus.APPROVED.value,
            flags=OrganizationMember.flags["sso:linked"],
        )

        response = self.client.get(self.url + "?query=ssoLinked:true")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["email"] == sso_member.email

        response = self.client.get(self.url + "?query=ssoLinked:false")
        assert response.status_code == 200
        assert len(response.data) == 2

    def test_2fa_enabled_query(self):
        response = self.client.get(self.url + "?query=has2fa:true")
        assert response.status_code == 200
        assert len(response.data) == 0

        user = self.create_user("morty@localhost", username="morty")
        member_2fa = self.create_member(
            organization=self.org,
            user=user,
            email=user.email,
            invite_status=InviteStatus.APPROVED.value,
        )

        # Two authenticators to ensure the user list is distinct
        Authenticator.objects.create(user=member_2fa.user, type=1)
        Authenticator.objects.create(user=member_2fa.user, type=2)

        response = self.client.get(self.url + "?query=has2fa:true")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["email"] == member_2fa.email

        response = self.client.get(self.url + "?query=has2fa:false")
        assert response.status_code == 200
        assert len(response.data) == 2

    def test_cannot_get_unapproved_invites(self):
        join_request = "test@email.com"
        invite_request = "test@gmail.com"

        self.create_member(
            organization=self.org,
            email=join_request,
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
        )

        self.create_member(
            organization=self.org,
            email=invite_request,
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )

        response = self.client.get(self.url)
        assert response.status_code == 200
        assert len(response.data) == 2
        assert response.data[0]["email"] == self.user_2.email
        assert response.data[1]["email"] == self.owner_user.email

        response = self.client.get(self.url + "?query=email:{}".format(join_request))
        assert response.status_code == 200
        assert response.data == []

        response = self.client.get(self.url + "?query=email:{}".format(invite_request))
        assert response.status_code == 200
        assert response.data == []

    def test_owner_invites(self):
        self.login_as(user=self.owner_user)
        response = self.client.post(
            self.url, {"email": "eric@localhost", "role": "owner", "teams": [self.team.slug]}
        )

        assert response.status_code == 201
        assert response.data["email"] == "eric@localhost"

    def test_valid_for_invites(self):
        self.login_as(user=self.owner_user)

        with self.settings(SENTRY_ENABLE_INVITES=True), self.tasks():
            resp = self.client.post(
                self.url, {"email": "foo@example.com", "role": "admin", "teams": [self.team.slug]}
            )
        assert resp.status_code == 201

        member = OrganizationMember.objects.get(organization=self.org, email="foo@example.com")

        assert member.user is None
        assert member.role == "admin"

        om_teams = OrganizationMemberTeam.objects.filter(organizationmember=member.id)

        assert len(om_teams) == 1
        assert om_teams[0].team_id == self.team.id

        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ["foo@example.com"]
        assert mail.outbox[0].subject == u"Join {} in using Sentry".format(self.org.name)

    def test_existing_user_for_invite(self):
        self.login_as(user=self.owner_user)

        user = self.create_user("foobar@example.com")

        member = OrganizationMember.objects.create(organization=self.org, user=user, role="member")

        with self.settings(SENTRY_ENABLE_INVITES=True):
            resp = self.client.post(
                self.url, {"email": user.email, "role": "member", "teams": [self.team.slug]}
            )

        assert resp.status_code == 400

        member = OrganizationMember.objects.get(id=member.id)

        assert member.email is None
        assert member.role == "member"

    def test_can_invite_with_invites_to_other_orgs(self):
        email = "test@gmail.com"
        org = self.create_organization(slug="diff-org")
        OrganizationMember.objects.create(email=email, organization=org)

        with self.settings(SENTRY_ENABLE_INVITES=True), self.tasks():
            resp = self.client.post(
                self.url, {"email": email, "role": "member", "teams": [self.team.slug]}
            )

        assert resp.status_code == 201

        member = OrganizationMember.objects.get(organization=self.org, email=email)
        assert len(mail.outbox) == 1
        assert member.role == "member"

    def test_valid_for_direct_add(self):
        self.login_as(user=self.owner_user)

        user = self.create_user("baz@example.com")

        with self.settings(SENTRY_ENABLE_INVITES=False):
            resp = self.client.post(
                self.url, {"email": user.email, "role": "member", "teams": [self.team.slug]}
            )

        assert resp.status_code == 201

        member = OrganizationMember.objects.get(organization=self.org, email=user.email)
        assert len(mail.outbox) == 0
        assert member.role == "member"

    def test_invalid_user_for_direct_add(self):
        self.login_as(user=self.owner_user)

        with self.settings(SENTRY_ENABLE_INVITES=False):
            resp = self.client.post(
                self.url,
                {"email": "notexisting@example.com", "role": "admin", "teams": [self.team.slug]},
            )

        assert resp.status_code == 201

        member = OrganizationMember.objects.get(
            organization=self.org, email="notexisting@example.com"
        )
        assert len(mail.outbox) == 0
        # todo(maxbittker) this test is a false positive, need to figure out why
        assert member.role == "admin"

    # permission role stuff:
    def test_manager_invites(self):
        manager_user = self.create_user("manager@localhost")
        self.manager = self.create_member(user=manager_user, organization=self.org, role="manager")
        self.login_as(user=manager_user)

        response = self.client.post(
            self.url, {"email": "eric@localhost", "role": "owner", "teams": [self.team.slug]}
        )

        assert response.status_code == 400

        response = self.client.post(
            self.url, {"email": "eric@localhost", "role": "manager", "teams": [self.team.slug]}
        )
        assert response.status_code == 201

        response = self.client.post(
            self.url, {"email": "eric@localhost", "role": "member", "teams": [self.team.slug]}
        )

        assert response.status_code == 400

    def test_admin_invites(self):
        admin_user = self.create_user("admin22@localhost")
        self.admin = self.create_member(user=admin_user, organization=self.org, role="admin")

        self.login_as(user=admin_user)

        response = self.client.post(
            self.url, {"email": "eric@localhost", "role": "owner", "teams": [self.team.slug]}
        )

        assert response.status_code == 403

        response = self.client.post(
            self.url, {"email": "eric@localhost", "role": "manager", "teams": [self.team.slug]}
        )

        assert response.status_code == 403

        response = self.client.post(
            self.url, {"email": "eric@localhost", "role": "member", "teams": [self.team.slug]}
        )

        assert response.status_code == 403  # is this one right?

    def test_member_invites(self):
        member_user = self.create_user("member@localhost")
        self.admin = self.create_member(user=member_user, organization=self.org, role="member")

        self.login_as(user=member_user)

        response = self.client.post(
            self.url, {"email": "eric@localhost", "role": "owner", "teams": [self.team.slug]}
        )

        assert response.status_code == 403

        response = self.client.post(
            self.url, {"email": "eric@localhost", "role": "manager", "teams": [self.team.slug]}
        )

        assert response.status_code == 403

        response = self.client.post(
            self.url, {"email": "eric@localhost", "role": "member", "teams": [self.team.slug]}
        )

        assert response.status_code == 403

    def test_respects_feature_flag(self):
        self.login_as(user=self.owner_user)

        user = self.create_user("baz@example.com")

        with Feature({"organizations:invite-members": False}):
            resp = self.client.post(
                self.url, {"email": user.email, "role": "member", "teams": [self.team.slug]}
            )

        assert resp.status_code == 403

    def test_no_team_invites(self):
        self.login_as(user=self.owner_user)
        response = self.client.post(
            self.url, {"email": "eric@localhost", "role": "owner", "teams": []}
        )

        assert response.status_code == 201
        assert response.data["email"] == "eric@localhost"

    def test_can_invite_member_with_pending_invite_request(self):
        self.login_as(user=self.owner_user)
        email = "test@gmail.com"

        invite_request = OrganizationMember.objects.create(
            email=email,
            organization=self.org,
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )

        with self.settings(SENTRY_ENABLE_INVITES=True), self.tasks():
            resp = self.client.post(
                self.url, {"email": email, "role": "member", "teams": [self.team.slug]}
            )

        assert resp.status_code == 201
        assert not OrganizationMember.objects.filter(id=invite_request.id).exists()
        assert OrganizationMember.objects.filter(organization=self.org, email=email).exists()
        assert len(mail.outbox) == 1

    def test_can_invite_member_with_pending_join_request(self):
        self.login_as(user=self.owner_user)
        email = "test@gmail.com"

        join_request = OrganizationMember.objects.create(
            email=email, organization=self.org, invite_status=InviteStatus.REQUESTED_TO_JOIN.value
        )

        with self.settings(SENTRY_ENABLE_INVITES=True), self.tasks():
            resp = self.client.post(
                self.url, {"email": email, "role": "member", "teams": [self.team.slug]}
            )

        assert resp.status_code == 201
        assert not OrganizationMember.objects.filter(id=join_request.id).exists()
        assert OrganizationMember.objects.filter(organization=self.org, email=email).exists()
        assert len(mail.outbox) == 1


class OrganizationMemberListPostTest(APITestCase):
    endpoint = "sentry-api-0-organization-member-index"
    method = "post"

    def setUp(self):
        self.owner_user = self.create_user("foo@localhost", username="foo")
        self.org = self.create_organization(owner=self.owner_user)
        self.team = self.create_team(organization=self.org)
        self.login_as(user=self.owner_user)

    def test_forbid_qq(self):
        resp = self.get_response(
            self.org.slug, email="1234@qq.com", role="member", teams=[self.team.slug]
        )
        assert resp.status_code == 400
        assert resp.data["email"][0] == "Enter a valid email address."

    @patch.object(OrganizationMember, "send_invite_email")
    def test_simple(self, mock_send_invite_email):
        resp = self.get_response(
            self.org.slug, email="jane@gmail.com", role="member", teams=[self.team.slug]
        )
        assert resp.status_code == 201
        om = OrganizationMember.objects.get(id=resp.data["id"])
        assert om.user_id is None
        assert om.email == "jane@gmail.com"
        assert om.role == "member"
        assert list(om.teams.all()) == [self.team]
        assert om.inviter == self.owner_user

        mock_send_invite_email.assert_called_once_with()

    def test_no_teams(self):
        resp = self.get_response(self.org.slug, email="jane@gmail.com", role="member")
        assert resp.status_code == 201
        om = OrganizationMember.objects.get(id=resp.data["id"])
        assert om.user_id is None
        assert om.email == "jane@gmail.com"
        assert om.role == "member"
        assert list(om.teams.all()) == []
        assert om.inviter == self.owner_user

    @patch.object(OrganizationMember, "send_invite_email")
    def test_no_email(self, mock_send_invite_email):
        resp = self.get_response(
            self.org.slug,
            email="jane@gmail.com",
            role="member",
            teams=[self.team.slug],
            sendInvite=False,
        )
        assert resp.status_code == 201
        om = OrganizationMember.objects.get(id=resp.data["id"])
        assert om.user_id is None
        assert om.email == "jane@gmail.com"
        assert om.role == "member"
        assert list(om.teams.all()) == [self.team]
        assert om.inviter == self.owner_user

        assert not mock_send_invite_email.mock_calls

    @patch("sentry.utils.ratelimits.for_organization_member_invite")
    def test_rate_limited(self, mock_rate_limit):
        mock_rate_limit.return_value = True

        resp = self.get_response(self.org.slug, email="jane@gmail.com", role="member",)
        assert resp.status_code == 429
        assert not OrganizationMember.objects.filter(email="jane@gmail.com").exists()
