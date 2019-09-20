from __future__ import absolute_import

from mock import patch

from sentry.models import AuthProvider, InviteStatus, OrganizationMember
from sentry.testutils import APITestCase
from sentry.api.endpoints.organization_request_join import REQUEST_JOIN_EXPERIMENT


class OrganizationRequestJoinTest(APITestCase):
    endpoint = "sentry-api-0-organization-request-join"
    method = "post"

    def setUp(self):
        super(OrganizationRequestJoinTest, self).setUp()
        self.email = "test@example.com"
        self.org = self.create_organization(owner=self.user)
        self.owner = OrganizationMember.objects.get(user=self.user, organization=self.org)

    def test_email_required(self):
        resp = self.get_response(self.org.slug)
        assert resp.status_code == 400
        assert resp.data["email"][0] == "This field is required."

    def test_invalid_email(self):
        resp = self.get_response(self.org.slug, email="invalid-email")
        assert resp.data["email"][0] == "Enter a valid email address."

    def test_invalid_org_slug(self):
        resp = self.get_response("invalid-slug", email=self.email)
        assert resp.status_code == 404

    @patch(
        "sentry.api.endpoints.organization_request_join.ratelimiter.is_limited", return_value=True
    )
    def test_ratelimit(self, is_limited):
        resp = self.get_response(self.org.slug, email=self.email)
        assert resp.status_code == 429
        assert resp.data["detail"] == "Rate limit exceeded."

    @patch("sentry.experiments.get", return_value=-1)
    def test_experiment(self, mock_experiment):
        resp = self.get_response(self.org.slug, email=self.email)
        assert resp.status_code == 403

        mock_experiment.assert_called_once_with(
            org=self.org, experiment_name=REQUEST_JOIN_EXPERIMENT
        )

    @patch("sentry.api.endpoints.organization_request_join.logger")
    @patch("sentry.experiments.get", return_value=1)
    def test_org_sso_enabled(self, mock_experiment, mock_log):
        AuthProvider.objects.create(organization=self.org, provider="google")

        resp = self.get_response(self.org.slug, email=self.email)
        assert resp.status_code == 204

        member = OrganizationMember.objects.get(organization=self.org)
        assert member == self.owner
        assert not mock_log.info.called

    @patch("sentry.api.endpoints.organization_request_join.logger")
    @patch("sentry.experiments.get", return_value=1)
    def test_user_already_exists(self, mock_experiment, mock_log):
        resp = self.get_response(self.org.slug, email=self.user.email)
        assert resp.status_code == 204

        member = OrganizationMember.objects.get(organization=self.org)
        assert member == self.owner
        assert not mock_log.info.called

    @patch("sentry.api.endpoints.organization_request_join.logger")
    @patch("sentry.experiments.get", return_value=1)
    def test_pending_member_already_exists(self, mock_experiment, mock_log):
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

    @patch("sentry.api.endpoints.organization_request_join.logger")
    @patch("sentry.experiments.get", return_value=1)
    def test_already_requested_to_join(self, mock_experiment, mock_log):
        request_join_email = "requestjoin@example.com"
        original_request_join = self.create_member(
            email=request_join_email,
            organization=self.org,
            role="member",
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
        )

        resp = self.get_response(self.org.slug, email=request_join_email)
        assert resp.status_code == 204

        members = OrganizationMember.objects.filter(organization=self.org)
        assert members.count() == 2
        request_join = members.get(email=request_join_email)
        assert request_join == original_request_join
        assert not mock_log.info.called

    @patch("sentry.api.endpoints.organization_request_join.logger")
    @patch("sentry.experiments.get", return_value=1)
    def test_request_to_join(self, mock_experiment, mock_log):
        resp = self.get_response(self.org.slug, email=self.email)
        assert resp.status_code == 204

        members = OrganizationMember.objects.filter(organization=self.org)
        assert members.count() == 2
        request_join = members.get(email=self.email)
        assert request_join.user is None
        assert request_join.role == "member"
        assert not request_join.invite_approved

        mock_log.info.assert_called_once_with(
            "request-join.created",
            extra={
                "organization_id": self.org.id,
                "member_id": request_join.id,
                "email": self.email,
                "ip_address": "127.0.0.1",
            },
        )
