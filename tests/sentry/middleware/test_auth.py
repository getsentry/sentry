from functools import cached_property
from unittest.mock import patch

from django.test import RequestFactory

from sentry.middleware.auth import AuthenticationMiddleware
from sentry.models.apikey import ApiKey
from sentry.models.apitoken import ApiToken
from sentry.models.userip import UserIP
from sentry.services.hybrid_cloud.auth import AuthenticatedToken
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.silo import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode
from sentry.utils.auth import login


@all_silo_test
class AuthenticationMiddlewareTestCase(TestCase):
    middleware = cached_property(AuthenticationMiddleware)

    def assert_user_equals(self, request):
        assert request.user == user_service.get_user(user_id=self.user.id)

    def setUp(self):
        from django.core.cache import cache

        cache.clear()
        yield
        cache.clear()

    @cached_property
    def request(self):
        rv = RequestFactory().get("/")
        rv.session = self.session
        return rv

    def test_process_request_anon(self):
        self.middleware.process_request(self.request)
        assert self.request.user.is_anonymous

    def test_process_request_user(self):
        request = self.request
        with assume_test_silo_mode(SiloMode.MONOLITH):
            assert login(request, self.user)
        with outbox_runner():
            self.middleware.process_request(request)
            # Force the user object to materialize
            request.user.id

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.user.refresh_from_db()
            assert UserIP.objects.filter(user_id=self.user.id, ip_address="127.0.0.1").exists()

        assert request.user.is_authenticated
        self.assert_user_equals(request)
        assert "_nonce" not in request.session

    def test_process_request_good_nonce(self):
        request = self.request
        user = self.user
        user.session_nonce = "xxx"
        with assume_test_silo_mode(SiloMode.CONTROL):
            user.save()
            assert login(request, user)
        self.middleware.process_request(request)
        assert request.user.is_authenticated
        self.assert_user_equals(request)
        assert request.session["_nonce"] == "xxx"

    def test_process_request_missing_nonce(self):
        request = self.request
        user = self.user
        user.session_nonce = "xxx"
        with assume_test_silo_mode(SiloMode.CONTROL):
            user.save()
            assert login(request, user)
        del request.session["_nonce"]
        self.middleware.process_request(request)
        assert request.user.is_anonymous

    def test_process_request_bad_nonce(self):
        request = self.request
        user = self.user
        user.session_nonce = "xxx"
        with assume_test_silo_mode(SiloMode.CONTROL):
            user.save()
            assert login(request, user)
        request.session["_nonce"] = "gtfo"
        self.middleware.process_request(request)
        assert request.user.is_anonymous

    def test_process_request_valid_authtoken(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=["event:read", "org:read"])
        request = self.make_request(method="GET")
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {token.token}"
        self.middleware.process_request(request)
        self.assert_user_equals(request)
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuthenticatedToken.from_token(request.auth) == AuthenticatedToken.from_token(
                token
            )

    def test_process_request_invalid_authtoken(self):
        request = self.make_request(method="GET")
        request.META["HTTP_AUTHORIZATION"] = "Bearer absadadafdf"
        self.middleware.process_request(request)
        # Should swallow errors and pass on
        assert request.user.is_anonymous
        assert request.auth is None

    def test_process_request_valid_apikey(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            apikey = ApiKey.objects.create(
                organization_id=self.organization.id, allowed_origins="*"
            )
            request = self.make_request(method="GET")
            request.META["HTTP_AUTHORIZATION"] = self.create_basic_auth_header(apikey.key)

        self.middleware.process_request(request)
        # ApiKey is tied to an organization not user
        assert request.user.is_anonymous
        assert AuthenticatedToken.from_token(request.auth) == AuthenticatedToken.from_token(apikey)

    def test_process_request_invalid_apikey(self):
        request = self.make_request(method="GET")
        request.META["HTTP_AUTHORIZATION"] = b"Basic adfasdfasdfsadfsaf"

        self.middleware.process_request(request)
        # Should swallow errors and pass on
        assert request.user.is_anonymous
        assert request.auth is None

    def test_process_request_rpc_path_ignored(self):
        request = self.make_request(
            method="GET", path="/api/0/internal/rpc/organization/get_organization_by_id"
        )
        request.META["HTTP_AUTHORIZATION"] = b"Rpcsignature not-a-checksum"

        self.middleware.process_request(request)
        # No errors, and no user identified.
        assert request.user.is_anonymous
        assert request.auth is None

    @patch("sentry.models.userip.geo_by_addr")
    def test_process_request_log_userip(self, mock_geo_by_addr):
        mock_geo_by_addr.return_value = {
            "country_code": "US",
            "region": "CA",
            "subdivision": "San Francisco",
        }
        request = self.request
        request.META["REMOTE_ADDR"] = "8.8.8.8"
        with assume_test_silo_mode(SiloMode.MONOLITH):
            assert login(request, self.user)

        with outbox_runner():
            self.middleware.process_request(request)
            # Should be logged in and have logged a UserIp record.
            assert request.user.id == self.user.id
            assert mock_geo_by_addr.call_count == 1

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert UserIP.objects.count() > 0
            userip = UserIP.objects.get(user_id=self.user.id)
        assert userip.ip_address == "8.8.8.8"
        assert userip.country_code == "US"
        assert userip.region_code == "CA"
