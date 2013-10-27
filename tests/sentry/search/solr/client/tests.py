import httpretty

from sentry.search.solr.client import SolrClient
from sentry.testutils import TestCase


class SolrClientTest(TestCase):
    def setUp(self):
        self.client = SolrClient('http://solr.example.com/solr/sentry/')

    @httpretty.activate
    def test_simple_update(self):
        httpretty.register_uri(
            httpretty.POST, 'http://solr.example.com/solr/sentry/update',
            body='')

        self.client.add([{
            'id': 'foo',
            'key': 'value',
        }])

        request = httpretty.last_request()
        assert request.body == (
            '<add><doc><field name="id">foo</field>'
            '<field name="key">value</field></doc></add>'
        )
