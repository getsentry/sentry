from unittest import mock

from django.test import override_settings
from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.viewer_context import Actor, ActorType, ViewerContext, encode_viewer_context


class OrganizationOnboardingContinuation(APITestCase):
    endpoint = "sentry-api-0-organization-onboarding-continuation-email"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    @mock.patch("sentry.api.endpoints.organization_onboarding_continuation_email.MessageBuilder")
    def test_basic(self, builder: mock.MagicMock) -> None:
        builder.return_value.send_async = mock.Mock()
        data = {"platforms": ["javascript", "python", "flutter"]}
        self.get_success_response(self.organization.slug, status_code=202, **data)

        expected_email_args = {
            "subject": "Finish Onboarding",
            "template": "sentry/emails/onboarding-continuation.txt",
            "html_template": "sentry/emails/onboarding-continuation.html",
            "type": "organization.onboarding-continuation-email",
            "context": {
                "recipient_name": self.user.get_display_name(),
                "onboarding_link": self.organization.absolute_url(
                    f"/onboarding/{self.organization.slug}/",
                    query="referrer=onboarding_continuation-email",
                ),
                "organization_name": self.organization.name,
                "num_platforms": 3,
                "platforms": "javascript, python, and flutter",
            },
        }

        builder.assert_called_with(**expected_email_args)
        builder.return_value.send_async.assert_called_with([self.user.email])

    def test_validation_error(self) -> None:
        data = {"platforms": "not a list"}
        resp = self.get_error_response(self.organization.slug, status_code=400, **data)
        assert resp.data["platforms"][0].code == "not_a_list"

    @mock.patch("sentry.api.endpoints.organization_onboarding_continuation_email.MessageBuilder")
    def test_non_member_rejected(self, builder: mock.MagicMock) -> None:
        other_user = self.create_user()
        other_org = self.create_organization(owner=other_user)
        # self.user is not a member of other_org
        data = {"platforms": ["javascript"]}
        self.get_error_response(other_org.slug, status_code=403, **data)
        builder.assert_not_called()

    @override_settings(SEER_API_SHARED_SECRET="service-account-secret")
    @with_feature("organizations:service-accounts")
    @mock.patch("sentry.api.endpoints.organization_onboarding_continuation_email.MessageBuilder")
    def test_service_account_is_user_required(self, builder: mock.MagicMock) -> None:
        service_account = self.create_service_account(
            organization=self.organization, scope_list=["org:read"]
        )
        viewer_context = encode_viewer_context(
            ViewerContext(
                actor=Actor(type=ActorType.SERVICE_ACCOUNT, actor_id=service_account.id),
                organization_id=self.organization.id,
            ),
            key="service-account-secret",
        )
        url = reverse(self.endpoint, args=[self.organization.slug])

        resp = self.client.post(
            url, {"platforms": ["javascript"]}, format="json", HTTP_X_VIEWER_CONTEXT=viewer_context
        )
        assert resp.status_code == 403, resp.content
        assert resp.data["detail"]["code"] == "user-required"
        builder.assert_not_called()
