from __future__ import absolute_import

from mock import patch
from exam import fixture

from django.test import RequestFactory
from sentry.testutils import TestCase
from sentry.middleware.health import HealthCheck
from sentry.utils import json


class HealthCheckTest(TestCase):
    middleware = fixture(HealthCheck)
    factory = fixture(RequestFactory)

    @patch('sentry.status_checks.check_all')
    def test_other_url(self, check_all):
        req = self.factory.get('/')
        resp = self.middleware.process_request(req)
        assert resp is None, resp
        assert check_all.call_count == 0

    @patch('sentry.status_checks.check_all')
    def test_basic_health(self, check_all):
        req = self.factory.get('/_health/')
        resp = self.middleware.process_request(req)
        assert resp.status_code == 200, resp
        assert check_all.call_count == 0

    @patch('sentry.status_checks.check_all')
    def test_full_health_ok(self, check_all):
        check_all.return_value = [], []
        req = self.factory.get('/_health/?full')
        resp = self.middleware.process_request(req)
        assert resp.status_code == 200, resp
        body = json.loads(resp.content)
        assert 'problems' in body
        assert 'healthy' in body
        assert check_all.call_count == 1

    @patch('sentry.status_checks.check_all')
    def test_full_health_bad(self, check_all):
        check_all.return_value = ['foo'], []
        req = self.factory.get('/_health/?full')
        resp = self.middleware.process_request(req)
        assert resp.status_code == 500, resp
        body = json.loads(resp.content)
        assert 'problems' in body
        assert 'healthy' in body
        assert check_all.call_count == 1
