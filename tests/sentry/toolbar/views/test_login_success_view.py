from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.toolbar.views.login_success_view import SUCCESS_TEMPLATE


class LoginSuccessViewTest(APITestCase):
    view_name = "sentry-toolbar-login-success"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(self.view_name, args=(self.organization.slug, self.project.slug))

    def test_get(self):
        response = self.client.get(self.url)
        assert response.status_code == 200
        self.assertTemplateUsed(response, SUCCESS_TEMPLATE)

    # TODO: csp tests (same as test_iframe_view)
