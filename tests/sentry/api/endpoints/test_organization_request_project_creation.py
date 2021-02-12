from sentry.testutils import APITestCase


from sentry.utils.compat import mock
from sentry.utils.http import absolute_uri


class OrganizationIntegrationRequestTest(APITestCase):
    endpoint = "sentry-api-0-organization-request-project-creation"
    method = "post"

    @mock.patch("sentry.utils.email.MessageBuilder")
    def test_basic(self, builder):
        self.login_as(user=self.user)
        with self.tasks():
            response = self.get_response(
                self.organization.slug,
                targetUserEmail="elon@tesla.com",
            )

            assert response.status_code == 201
        requester_name = self.user.get_display_name()
        requester_link = absolute_uri(
            f"/organizations/{self.organization.slug}/projects/new/?referrer=request_project&category=mobile"
        )

        expected_email_args = {
            "subject": f"{requester_name} thinks Sentry can help monitor your mobile app",
            "template": "sentry/emails/requests/organization-project.txt",
            "html_template": "sentry/emails/requests/organization-project.html",
            "type": "organization.project.request",
            "context": {
                "requester_name": requester_name,
                "requester_link": requester_link,
            },
        }
        builder.assert_called_with(**expected_email_args)
        builder.return_value.send_async.assert_called_once_with(["elon@tesla.com"])
