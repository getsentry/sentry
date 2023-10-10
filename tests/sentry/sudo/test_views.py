from django.template.response import TemplateResponse
from django.test import override_settings

from fixtures.sudo_testutils import BaseTestCase
from sudo.forms import SudoForm
from sudo.settings import REDIRECT_FIELD_NAME, REDIRECT_TO_FIELD_NAME, REDIRECT_URL
from sudo.views import redirect_to_sudo, sudo


@override_settings(
    AUTHENTICATION_BACKENDS=[
        "fixtures.sudo_testutils.FooPasswordBackend",
        "fixtures.sudo_testutils.StubPasswordBackend",
    ]
)
class SudoViewTestCase(BaseTestCase):
    def test_enforces_logged_in(self):
        response = sudo(self.request)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/auth/login/?next=/foo")

    def test_returns_template_response(self):
        self.login()
        self.request.is_sudo = lambda: False
        response = sudo(self.request)
        assert isinstance(response, TemplateResponse)
        self.assertEqual(response.template_name, "sudo/sudo.html")  # default
        assert response.context_data is not None
        self.assertEqual(response.context_data[REDIRECT_FIELD_NAME], REDIRECT_URL)  # default
        form = response.context_data["form"]
        assert isinstance(form, SudoForm)
        self.assertEqual(form.user, self.user)

    def test_returns_template_response_with_next(self):
        self.login()
        self.request.GET = {REDIRECT_FIELD_NAME: "/lol"}
        self.request.is_sudo = lambda: False
        response = sudo(self.request)
        assert isinstance(response, TemplateResponse)
        assert response.context_data is not None
        self.assertEqual(response.context_data[REDIRECT_FIELD_NAME], "/lol")  # default

    def test_returns_template_response_override_template(self):
        self.login()
        self.request.is_sudo = lambda: False
        response = sudo(self.request, template_name="foo.html")
        assert isinstance(response, TemplateResponse)
        self.assertEqual(response.template_name, "foo.html")

    def test_returns_template_response_override_extra_context(self):
        self.login()
        self.request.is_sudo = lambda: False
        response = sudo(self.request, extra_context={"foo": "bar"})
        assert isinstance(response, TemplateResponse)
        assert response.context_data is not None
        self.assertEqual(response.context_data["foo"], "bar")

    def test_redirect_if_already_sudo(self):
        self.login()
        self.request.is_sudo = lambda: True
        response = sudo(self.request)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], REDIRECT_URL)

    def test_redirect_fix_bad_url(self):
        self.login()
        self.request.is_sudo = lambda: True
        self.request.GET = {REDIRECT_FIELD_NAME: "http://mattrobenolt.com/lol"}
        response = sudo(self.request)
        self.assertEqual(response["Location"], REDIRECT_URL)
        self.request.GET = {
            REDIRECT_FIELD_NAME: "http://%s\\@mattrobenolt.com" % self.request.get_host(),
        }
        response = sudo(self.request)
        self.assertEqual(response["Location"], REDIRECT_URL)

    def test_redirect_if_already_sudo_with_next(self):
        self.login()
        self.request.GET = {REDIRECT_FIELD_NAME: "/lol"}
        self.request.is_sudo = lambda: True
        response = sudo(self.request)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/lol")

    def test_redirect_after_successful_post(self):
        self.login()
        self.request.is_sudo = lambda: False
        self.request.method = "POST"
        self.request.csrf_processing_done = True
        self.request.POST = {"password": "foo"}
        response = sudo(self.request)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], REDIRECT_URL)

    def test_session_based_redirect(self):
        self.login()
        self.request.is_sudo = lambda: False
        self.request.method = "GET"
        self.request.GET = {REDIRECT_FIELD_NAME: "/foobar"}
        sudo(self.request)

        self.request, self.request.session = self.post("/foo"), self.request.session
        self.login()
        self.request.is_sudo = lambda: False
        self.request.method = "POST"
        self.request.POST = {"password": "foo"}
        self.request.csrf_processing_done = True
        response = sudo(self.request)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/foobar")
        self.assertNotEqual(response["Location"], REDIRECT_URL)
        self.assertFalse("redirect_to" in self.request.session)

    def test_session_based_redirect_bad_url(self):
        self.login()
        self.request.is_sudo = lambda: False
        self.request.method = "POST"
        self.request.POST = {"password": "foo"}
        self.request.session[REDIRECT_TO_FIELD_NAME] = "http://mattrobenolt.com/lol"
        self.request.csrf_processing_done = True
        response = sudo(self.request)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], REDIRECT_URL)
        self.assertFalse("redirect_to" in self.request.session)
        self.request.session[REDIRECT_TO_FIELD_NAME] = (
            "http://%s\\@mattrobenolt.com" % self.request.get_host()
        )
        response = sudo(self.request)
        self.assertEqual(response["Location"], REDIRECT_URL)

    def test_render_form_with_bad_password(self):
        self.login()
        self.request.is_sudo = lambda: False
        self.request.method = "POST"
        self.request.csrf_processing_done = True
        self.request.POST = {"password": "lol"}
        response = sudo(self.request)
        assert isinstance(response, TemplateResponse)
        self.assertEqual(response.status_code, 200)
        assert response.context_data is not None
        form = response.context_data["form"]
        self.assertFalse(form.is_valid())


class RedirectToSudoTestCase(BaseTestCase):
    def test_redirect_to_sudo_simple(self):
        response = redirect_to_sudo("/foo")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/account/sudo/?next=/foo")

    def test_redirect_to_sudo_with_querystring(self):
        response = redirect_to_sudo("/foo?foo=bar")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/account/sudo/?next=/foo%3Ffoo%3Dbar")
