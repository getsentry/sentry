from __future__ import absolute_import

from exam import fixture
from sentry.utils.compat.mock import patch
from django.core import mail

from sentry.models import AuthProvider, InviteStatus, OrganizationOption, OrganizationMember
from sentry.testutils import APITestCase


class OrganizationJoinRequestTest(APITestCase):
    endpoint = "sentry-api-0-organization-join-request"
    method = "post"

    def setUp(self):
        super(OrganizationJoinRequestTest, self).setUp()
        self.email = "test@example.com"
        self.org = self.create_organization(owner=self.user)

    @fixture
    def owner(self):
        return OrganizationMember.objects.get(user=self.user, organization=self.org)

    def test_invalid_org_slug(self):
        resp = self.get_response("invalid-slug", email=self.email)
        assert resp.status_code == 404

    def test_email_required(self):
        resp = self.get_response(self.org.slug)
        assert resp.status_code == 400
        assert resp.data["email"][0] == "This field is required."

    def test_invalid_email(self):
        resp = self.get_response(self.org.slug, email="invalid-email")
        assert resp.status_code == 400
        assert resp.data["email"][0] == "Enter a valid email address."

    def test_organization_setting_disabled(self):
        OrganizationOption.objects.create(
            organization_id=self.org.id, key="sentry:join_requests", value=False
        )

        resp = self.get_response(self.org.slug)
        assert resp.status_code == 403

    @patch(
        "sentry.api.endpoints.organization_join_request.ratelimiter.is_limited", return_value=True
    )
    def test_ratelimit(self, is_limited):
        resp = self.get_response(self.org.slug, email=self.email)
        assert resp.status_code == 429
        assert resp.data["detail"] == "Rate limit exceeded."

    @patch("sentry.api.endpoints.organization_join_request.logger")
    def test_org_sso_enabled(self, mock_log):
        AuthProvider.objects.create(organization=self.org, provider="google")

        resp = self.get_response(self.org.slug, email=self.email)
        assert resp.status_code == 403

        member = OrganizationMember.objects.get(organization=self.org)
        assert member == self.owner
        assert not mock_log.info.called

    @patch("sentry.api.endpoints.organization_join_request.logger")
    def test_user_already_exists(self, mock_log):
        resp = self.get_response(self.org.slug, email=self.user.email)
        assert resp.status_code == 204

        member = OrganizationMember.objects.get(organization=self.org)
        assert member == self.owner
        assert not mock_log.info.called

    @patch("sentry.api.endpoints.organization_join_request.logger")
    def test_pending_member_already_exists(self, mock_log):
        pending_email = "pending@example.com"
        original_pending = self.create_member(
            email=pending_email, organization=self.org, role="admin"
        )

        resp = self.get_response(self.org.slug, email=pending_email)
        assert resp.status_code == 204

        members = OrganizationMember.objects.filter(organization=self.org)
        assert members.count() == 2
        pending = members.get(email=pending_email)
        assert pending == original_pending
        assert not mock_log.info.called

    @patch("sentry.analytics.record")
    @patch("sentry.api.endpoints.organization_join_request.logger")
    def test_already_requested_to_join(self, mock_log, mock_record):
        join_request_email = "join-request@example.com"
        original_join_request = self.create_member(
            email=join_request_email,
            organization=self.org,
            role="member",
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
        )

        resp = self.get_response(self.org.slug, email=join_request_email)
        assert resp.status_code == 204

        members = OrganizationMember.objects.filter(organization=self.org)
        assert members.count() == 2
        join_request = members.get(email=join_request_email)
        assert join_request == original_join_request
        assert not mock_log.info.called

        assert not any(c[0][0] == "join_request.created" for c in mock_record.call_args_list)

    @patch("sentry.analytics.record")
    def test_request_to_join(self, mock_record):
        with self.tasks():
            resp = self.get_response(self.org.slug, email=self.email)

        assert resp.status_code == 204

        members = OrganizationMember.objects.filter(organization=self.org)
        assert members.count() == 2
        join_request = members.get(email=self.email)
        assert join_request.user is None
        assert join_request.role == "member"
        assert not join_request.invite_approved

        mock_record.assert_called_with(
            "join_request.created", member_id=join_request.id, organization_id=self.org.id
        )

        assert len(mail.outbox) == 1
