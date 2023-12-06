from functools import cached_property
from urllib.parse import parse_qs, urlparse

import responses
from django.core import mail
from django.urls import reverse

from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.testutils.cases import APITestCase, SlackActivityNotificationTest
from sentry.testutils.helpers.slack import get_attachment_no_text
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import region_silo_test
from sentry.utils import json


@region_silo_test
class OrganizationInviteRequestListTest(APITestCase):
    endpoint = "sentry-api-0-organization-invite-request-index"

    @cached_property
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


@region_silo_test
class OrganizationInviteRequestCreateTest(
    APITestCase, SlackActivityNotificationTest, HybridCloudTestMixin
):
    endpoint = "sentry-api-0-organization-invite-request-index"
    method = "post"

    def setUp(self):
        self.organization = self.create_organization()

        # SlackActivityNotificationTest needs the manager as self.user to create the identity
        self.user = self.create_user(email="manager@localhost")
        self.create_member(user=self.user, organization=self.organization, role="manager")
        super().setUp()

        # different user for logging in
        self.user = self.create_user("foo@localhost")
        self.team = self.create_team(organization=self.organization)
        self.member = self.create_member(
            user=self.user, organization=self.organization, role="member"
        )

        self.login_as(user=self.user)

        self.url = reverse(
            "sentry-api-0-organization-invite-request-index",
            kwargs={"organization_slug": self.organization.slug},
        )

    def test_simple(self):
        self.login_as(user=self.user)

        with self.tasks(), outbox_runner():
            response = self.client.post(
                self.url, {"email": "eric@localhost", "role": "member", "teams": [self.team.slug]}
            )

        assert response.status_code == 201
        assert response.data["email"] == "eric@localhost"

        assert len(mail.outbox) == 1

        member = OrganizationMember.objects.get(
            organization=self.organization, email=response.data["email"]
        )
        assert member.user_id is None
        assert member.role == "member"
        assert member.inviter_id == self.user.id
        assert member.invite_status == InviteStatus.REQUESTED_TO_BE_INVITED.value

        teams = OrganizationMemberTeam.objects.filter(organizationmember=member)

        assert len(teams) == 1
        assert teams[0].team_id == self.team.id

        self.assert_org_member_mapping(org_member=member)

    def test_higher_role(self):
        self.login_as(user=self.user)
        response = self.client.post(
            self.url, {"email": "eric@localhost", "role": "owner", "teams": [self.team.slug]}
        )

        assert response.status_code == 201
        assert response.data["email"] == "eric@localhost"

        member = OrganizationMember.objects.get(
            organization=self.organization, email=response.data["email"]
        )
        assert member.role == "owner"

    def test_existing_member(self):
        self.login_as(user=self.user)

        user2 = self.create_user("foobar@example.com")
        self.create_member(user=user2, organization=self.organization)

        resp = self.client.post(
            self.url, {"email": user2.email, "role": "member", "teams": [self.team.slug]}
        )

        assert resp.status_code == 400
        assert ("The user %s is already a member" % user2.email).encode("utf-8") in resp.content

    def test_existing_invite_request(self):
        self.login_as(user=self.user)

        invite_request = self.create_member(
            email="foobar@example.com",
            organization=self.organization,
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )

        resp = self.client.post(
            self.url, {"email": invite_request.email, "role": "member", "teams": [self.team.slug]}
        )

        assert resp.status_code == 400
        assert ("There is an existing invite request for %s" % invite_request.email).encode(
            "utf-8"
        ) in resp.content

    def test_request_to_invite_email(self):
        with self.tasks():
            resp = self.get_success_response(
                self.organization.slug,
                email="eric@localhost",
                role="member",
                teams=[self.team.slug],
                status_code=201,
            )

        members = OrganizationMember.objects.filter(organization=self.organization)
        join_request = members.get(email=resp.data["email"])
        assert join_request.user_id is None
        assert join_request.role == "member"
        assert not join_request.invite_approved

        assert len(mail.outbox) == 1

        assert mail.outbox[0].to == ["manager@localhost"]

        expected_subject = f"Access request to {self.organization.name}"
        assert mail.outbox[0].subject == expected_subject
        assert "eric@localhost" in mail.outbox[0].body

    @responses.activate
    def test_request_to_invite_slack(self):
        with self.tasks():
            self.get_success_response(
                self.organization.slug,
                email="eric@localhost",
                role="member",
                teams=[self.team.slug],
                status_code=201,
            )

        attachment = get_attachment_no_text()
        assert (
            attachment["text"]
            == f"foo@localhost is requesting to invite eric@localhost into {self.organization.name}"
        )
        notification_uuid = parse_qs(urlparse(attachment["actions"][2]["url"]).query)[
            "notification_uuid"
        ][0]
        assert attachment["actions"] == [
            {
                "text": "Approve",
                "name": "Approve",
                "style": "primary",
                "type": "button",
                "value": "approve_member",
                "action_id": "approve_request",
            },
            {
                "text": "Reject",
                "name": "Reject",
                "style": "danger",
                "type": "button",
                "value": "reject_member",
                "action_id": "approve_request",
            },
            {
                "text": "See Members & Requests",
                "name": "See Members & Requests",
                "url": f"http://testserver/settings/{self.organization.slug}/members/?referrer=invite_request-slack-user&notification_uuid={notification_uuid}",
                "type": "button",
            },
        ]
        assert (
            attachment["footer"]
            == f"You are receiving this notification because you have the scope member:write | <http://testserver/settings/account/notifications/approval/?referrer=invite_request-slack-user&notification_uuid={notification_uuid}|Notification Settings>"
        )
        member = OrganizationMember.objects.get(email="eric@localhost")
        assert json.loads(attachment["callback_id"]) == {
            "member_id": member.id,
            "member_email": "eric@localhost",
        }
