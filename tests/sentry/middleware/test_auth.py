from __future__ import absolute_import

from django.test import RequestFactory
from exam import fixture

from sentry.testutils import TestCase
from sentry.middleware.auth import AuthenticationMiddleware
from sentry.utils.auth import login


class AuthenticationMiddlewareTestCase(TestCase):
    middleware = fixture(AuthenticationMiddleware)

    @fixture
    def request(self):
        rv = RequestFactory().get('/')
        rv.session = self.session
        return rv

    def test_process_request_anon(self):
        self.middleware.process_request(self.request)
        assert self.request.user.is_anonymous()

    def test_process_request_user(self):
        request = self.request
        assert login(request, self.user)
        self.middleware.process_request(request)
        assert request.user.is_authenticated()
        assert request.user == self.user
        assert '_nonce' not in request.session

    def test_process_request_good_nonce(self):
        request = self.request
        user = self.user
        user.session_nonce = 'xxx'
        user.save()
        assert login(request, user)
        self.middleware.process_request(request)
        assert request.user.is_authenticated()
        assert request.user == self.user
        assert request.session['_nonce'] == 'xxx'

    def test_process_request_missing_nonce(self):
        request = self.request
        user = self.user
        user.session_nonce = 'xxx'
        user.save()
        assert login(request, user)
        del request.session['_nonce']
        self.middleware.process_request(request)
        assert request.user.is_anonymous()

    def test_process_request_bad_nonce(self):
        request = self.request
        user = self.user
        user.session_nonce = 'xxx'
        user.save()
        assert login(request, user)
        request.session['_nonce'] = 'gtfo'
        self.middleware.process_request(request)
        assert request.user.is_anonymous()
