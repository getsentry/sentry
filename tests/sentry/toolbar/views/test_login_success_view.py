from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.toolbar.views.login_success_view import TEMPLATE


class LoginSuccessViewTest(APITestCase):
    view_name = "sentry-toolbar-login-success"

    def setUp(self) -> None:
        super().setUp()
        self.url = reverse(self.view_name, args=(self.organization.slug, self.project.slug))

    def test_get_without_auth(self) -> None:
        res = self.client.get(self.url)
        assert res.status_code == 200
        self.assertTemplateUsed(res, TEMPLATE)
        assert "The Sentry Toolbar is no longer available" in res.content.decode("utf-8")
