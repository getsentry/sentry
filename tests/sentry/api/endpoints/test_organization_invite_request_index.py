from __future__ import absolute_import

from django.core import mail
from django.core.urlresolvers import reverse
from exam import fixture

from sentry.testutils import APITestCase
from sentry.models import (
    OrganizationMember,
    OrganizationMemberTeam,
    OrganizationOption,
    InviteStatus,
)


class OrganizationInviteRequestListTest(APITestCase):
    endpoint = "sentry-api-0-organization-invite-request-index"

    @fixture
    def org(self):
        return self.create_organization(owner=self.user)

    def setUp(self):
        self.invite_request = self.create_member(
            email="test@example.com",
            organization=self.org,
            role="member",
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )
        self.request_to_join = self.create_member(
            email="example@gmail.com",
            organization=self.org,
            role="member",
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
        )

    def test_simple(self):
        self.login_as(user=self.user)
        resp = self.get_response(self.org.slug)

        assert resp.status_code == 200
        assert len(resp.data) == 2
        assert resp.data[0]["email"] == self.invite_request.email
        assert resp.data[0]["inviteStatus"] == "requested_to_be_invited"
        assert resp.data[1]["email"] == self.request_to_join.email
        assert resp.data[1]["inviteStatus"] == "requested_to_join"

    def test_join_requests_disabled(self):
        OrganizationOption.objects.create(
            organization_id=self.org.id, key="sentry:join_requests", value=False
        )

        self.login_as(user=self.user)
        resp = self.get_response(self.org.slug)

        assert resp.status_code == 200
        assert len(resp.data) == 1
        assert resp.data[0]["email"] == self.invite_request.email
        assert resp.data[0]["inviteStatus"] == "requested_to_be_invited"


class OrganizationInviteRequestCreateTest(APITestCase):
    def setUp(self):
        self.user = self.create_user("foo@localhost")
        manager = self.create_user(email="manager@localhost")

        self.org = self.create_organization()
        self.team = self.create_team(organization=self.org)
        self.member = self.create_member(user=self.user, organization=self.org, role="member")
        self.create_member(user=manager, organization=self.org, role="manager")

        self.login_as(user=self.user)

        self.url = reverse(
            "sentry-api-0-organization-invite-request-index",
            kwargs={"organization_slug": self.org.slug},
        )

    def test_simple(self):
        self.login_as(user=self.user)
        with self.tasks():
            response = self.client.post(
                self.url, {"email": "eric@localhost", "role": "member", "teams": [self.team.slug]}
            )

        assert response.status_code == 201
        assert response.data["email"] == "eric@localhost"

        assert len(mail.outbox) == 1

        member = OrganizationMember.objects.get(organization=self.org, email=response.data["email"])
        assert member.user is None
        assert member.role == "member"
        assert member.inviter == self.user
        assert member.invite_status == InviteStatus.REQUESTED_TO_BE_INVITED.value

        teams = OrganizationMemberTeam.objects.filter(organizationmember=member)

        assert len(teams) == 1
        assert teams[0].team_id == self.team.id

    def test_higher_role(self):
        self.login_as(user=self.user)
        response = self.client.post(
            self.url, {"email": "eric@localhost", "role": "owner", "teams": [self.team.slug]}
        )

        assert response.status_code == 201
        assert response.data["email"] == "eric@localhost"

        member = OrganizationMember.objects.get(organization=self.org, email=response.data["email"])
        assert member.role == "owner"

    def test_existing_member(self):
        self.login_as(user=self.user)

        user2 = self.create_user("foobar@example.com")
        self.create_member(user=user2, organization=self.org)

        resp = self.client.post(
            self.url, {"email": user2.email, "role": "member", "teams": [self.team.slug]}
        )

        assert resp.status_code == 400
        assert (u"The user %s is already a member" % user2.email).encode("utf-8") in resp.content

    def test_existing_invite_request(self):
        self.login_as(user=self.user)

        invite_request = self.create_member(
            email="foobar@example.com",
            organization=self.org,
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )

        resp = self.client.post(
            self.url, {"email": invite_request.email, "role": "member", "teams": [self.team.slug]}
        )

        assert resp.status_code == 400
        assert (u"There is an existing invite request for %s" % invite_request.email).encode(
            "utf-8"
        ) in resp.content
