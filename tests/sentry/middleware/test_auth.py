import base64

from django.test import RequestFactory
from exam import fixture

from sentry.middleware.auth import AuthenticationMiddleware
from sentry.models import ApiKey, ApiToken, UserIP
from sentry.testutils import TestCase
from sentry.utils.auth import login


class AuthenticationMiddlewareTestCase(TestCase):
    middleware = fixture(AuthenticationMiddleware)

    @fixture
    def request(self):
        rv = RequestFactory().get("/")
        rv.session = self.session
        return rv

    def test_process_request_anon(self):
        self.middleware.process_request(self.request)
        assert self.request.user.is_anonymous

    def test_process_request_user(self):
        request = self.request
        assert login(request, self.user)
        self.middleware.process_request(request)
        assert request.user.is_authenticated
        assert request.user == self.user
        assert "_nonce" not in request.session
        assert UserIP.objects.filter(user=self.user, ip_address="127.0.0.1").exists()

    def test_process_request_good_nonce(self):
        request = self.request
        user = self.user
        user.session_nonce = "xxx"
        user.save()
        assert login(request, user)
        self.middleware.process_request(request)
        assert request.user.is_authenticated
        assert request.user == self.user
        assert request.session["_nonce"] == "xxx"

    def test_process_request_missing_nonce(self):
        request = self.request
        user = self.user
        user.session_nonce = "xxx"
        user.save()
        assert login(request, user)
        del request.session["_nonce"]
        self.middleware.process_request(request)
        assert request.user.is_anonymous

    def test_process_request_bad_nonce(self):
        request = self.request
        user = self.user
        user.session_nonce = "xxx"
        user.save()
        assert login(request, user)
        request.session["_nonce"] = "gtfo"
        self.middleware.process_request(request)
        assert request.user.is_anonymous

    def test_process_request_valid_authtoken(self):
        token = ApiToken.objects.create(user=self.user, scope_list=["event:read", "org:read"])
        request = self.make_request(method="GET")
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {token.token}"
        self.middleware.process_request(request)
        assert request.user == self.user
        assert request.auth == token

    def test_process_request_invalid_authtoken(self):
        request = self.make_request(method="GET")
        request.META["HTTP_AUTHORIZATION"] = "Bearer absadadafdf"
        self.middleware.process_request(request)
        # Should swallow errors and pass on
        assert request.user.is_anonymous
        assert request.auth is None

    def test_process_request_valid_apikey(self):
        apikey = ApiKey.objects.create(organization=self.organization, allowed_origins="*")

        request = self.make_request(method="GET")
        request.META["HTTP_AUTHORIZATION"] = b"Basic " + base64.b64encode(
            apikey.key.encode("utf-8")
        )

        self.middleware.process_request(request)
        # ApiKey is tied to an organization not user
        assert request.user.is_anonymous
        assert request.auth == apikey

    def test_process_request_invalid_apikey(self):
        request = self.make_request(method="GET")
        request.META["HTTP_AUTHORIZATION"] = b"Basic adfasdfasdfsadfsaf"

        self.middleware.process_request(request)
        # Should swallow errors and pass on
        assert request.user.is_anonymous
        assert request.auth is None
