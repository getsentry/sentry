# -*- coding: utf-8 -*-
from __future__ import absolute_import

from sentry.utils.compat.mock import Mock

from sentry.testutils import TestCase

from sentry.api.base import Endpoint


class EndpointTest(TestCase):
    def test_simple(self):
        request = Mock()
        request.GET = {"member": ["1"]}
        request.method = "GET"
        request.path = "/api/0/organizations/"
        endpoint = Endpoint()
        result = endpoint.build_cursor_link(request, "next", "1492107369532:0:0")

        assert result == (
            "<http://testserver/api/0/organizations/?member=%5B%271%27%5D&cursor=1492107369532:0:0>;"
            ' rel="next"; results="true"; cursor="1492107369532:0:0"'
        )

    def test_unicode_path(self):
        request = Mock()
        request.GET = {"member": ["1"]}
        request.method = "GET"
        request.path = "/api/0/organizations/üuuuu/"
        endpoint = Endpoint()
        result = endpoint.build_cursor_link(request, "next", "1492107369532:0:0")

        assert result == (
            "<http://testserver/api/0/organizations/%C3%BCuuuu/?member=%5B%271%27%5D&cursor=1492107369532:0:0>;"
            ' rel="next"; results="true"; cursor="1492107369532:0:0"'
        )
