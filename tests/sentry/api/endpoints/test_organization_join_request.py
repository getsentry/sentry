from django.core import mail
from exam import fixture

from sentry.models import AuthProvider, InviteStatus, OrganizationMember, OrganizationOption
from sentry.testutils import APITestCase
from sentry.utils.compat.mock import patch


class OrganizationJoinRequestTest(APITestCase):
    endpoint = "sentry-api-0-organization-join-request"
    method = "post"

    def setUp(self):
        super().setUp()
        self.email = "test@example.com"

    @fixture
    def owner(self):
        return OrganizationMember.objects.get(user=self.user, organization=self.organization)

    def test_invalid_org_slug(self):
        self.get_error_response("invalid-slug", email=self.email, status_code=404)

    def test_email_required(self):
        response = self.get_error_response(self.organization.slug, status_code=400)
        assert response.data["email"][0] == "This field is required."

    def test_invalid_email(self):
        response = self.get_error_response(
            self.organization.slug, email="invalid-email", status_code=400
        )
        assert response.data["email"][0] == "Enter a valid email address."

    def test_organization_setting_disabled(self):
        OrganizationOption.objects.create(
            organization_id=self.organization.id, key="sentry:join_requests", value=False
        )

        self.get_error_response(self.organization.slug, status_code=403)

    @patch(
        "sentry.api.endpoints.organization_join_request.ratelimiter.is_limited", return_value=True
    )
    def test_ratelimit(self, is_limited):
        response = self.get_error_response(
            self.organization.slug, email=self.email, status_code=429
        )
        assert response.data["detail"] == "Rate limit exceeded."

    @patch("sentry.api.endpoints.organization_join_request.logger")
    def test_org_sso_enabled(self, mock_log):
        AuthProvider.objects.create(organization=self.organization, provider="google")

        self.get_error_response(self.organization.slug, email=self.email, status_code=403)

        member = OrganizationMember.objects.get(organization=self.organization)
        assert member == self.owner
        assert not mock_log.info.called

    @patch("sentry.api.endpoints.organization_join_request.logger")
    def test_user_already_exists(self, mock_log):
        self.get_success_response(self.organization.slug, email=self.user.email, status_code=204)

        member = OrganizationMember.objects.get(organization=self.organization)
        assert member == self.owner
        assert not mock_log.info.called

    @patch("sentry.api.endpoints.organization_join_request.logger")
    def test_pending_member_already_exists(self, mock_log):
        pending_email = "pending@example.com"
        original_pending = self.create_member(
            email=pending_email, organization=self.organization, role="admin"
        )

        self.get_success_response(self.organization.slug, email=pending_email, status_code=204)

        members = OrganizationMember.objects.filter(organization=self.organization)
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
            organization=self.organization,
            role="member",
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
        )

        self.get_success_response(self.organization.slug, email=join_request_email, status_code=204)

        members = OrganizationMember.objects.filter(organization=self.organization)
        assert members.count() == 2
        join_request = members.get(email=join_request_email)
        assert join_request == original_join_request
        assert not mock_log.info.called

        assert not any(c[0][0] == "join_request.created" for c in mock_record.call_args_list)

    @patch("sentry.analytics.record")
    def test_request_to_join(self, mock_record):
        with self.tasks():
            self.get_success_response(self.organization.slug, email=self.email, status_code=204)

        members = OrganizationMember.objects.filter(organization=self.organization)
        assert members.count() == 2
        join_request = members.get(email=self.email)
        assert join_request.user is None
        assert join_request.role == "member"
        assert not join_request.invite_approved

        mock_record.assert_called_with(
            "join_request.created", member_id=join_request.id, organization_id=self.organization.id
        )

        assert len(mail.outbox) == 1
