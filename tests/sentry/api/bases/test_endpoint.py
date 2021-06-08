from django.http import QueryDict

from sentry.api.base import Endpoint
from sentry.testutils import TestCase
from sentry.utils.compat.mock import Mock


class EndpointTest(TestCase):
    def test_simple(self):
        request = Mock()
        request.GET = QueryDict("member=1&cursor=foo")
        request.method = "GET"
        request.path = "/api/0/organizations/"
        endpoint = Endpoint()
        result = endpoint.build_cursor_link(request, "next", "1492107369532:0:0")

        assert result == (
            "<http://testserver/api/0/organizations/?member=1&cursor=1492107369532:0:0>;"
            ' rel="next"; results="true"; cursor="1492107369532:0:0"'
        )

    def test_unicode_path(self):
        request = Mock()
        request.GET = QueryDict("member=1")
        request.method = "GET"
        request.path = "/api/0/organizations/üuuuu/"
        endpoint = Endpoint()
        result = endpoint.build_cursor_link(request, "next", "1492107369532:0:0")

        assert result == (
            "<http://testserver/api/0/organizations/%C3%BCuuuu/?member=1&cursor=1492107369532:0:0>;"
            ' rel="next"; results="true"; cursor="1492107369532:0:0"'
        )
