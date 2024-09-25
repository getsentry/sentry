from django.urls import reverse

from sentry.testutils.cases import APITestCase
from tests.sentry.toolbar.utils.test_http import get_directives


class LoginSuccessViewTest(APITestCase):
    view_name = "sentry-toolbar-login-success"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(self.view_name, args=(self.organization.slug, self.project.slug))

    def test_csp(self):
        res = self.client.get(self.url)
        csp = res.headers.get("Content-Security-Policy")
        directives = get_directives(csp)

        assert "script-src" in directives
        script_src = directives["script-src"]
        for src in ["sentry.io", "*.sentry.io"]:
            assert src in script_src
        assert any([src == "'unsafe-inline'" or src.startswith("'nonce-") for src in script_src])

    # TODO: success template test
