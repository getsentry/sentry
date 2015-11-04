from __future__ import absolute_import, print_function

import mock
import responses

from sentry import options
from sentry.testutils import TestCase
from sentry.tasks.sync_docs import sync_docs, sync_integration_docs

INDEX_JSON = """
{
  "platforms": {
    "go": {
      "_self": {
        "doc_link": "https://docs.getsentry.com/hosted/clients/go/",
        "name": "Go",
        "details": "go.json",
        "type": "language"
      },
      "http": {
        "doc_link": null,
        "name": "net/http",
        "details": "go/http.json",
        "type": "framework"
      }
    }
  }
}
""".strip()

GO_JSON = """
{
  "doc_link": "https://docs.getsentry.com/hosted/clients/go/",
  "name": "Go",
  "type": "language",
  "support_level": null,
  "body": "foo bar"
}
""".strip()

GO_HTTP_JSON = """
{
  "doc_link": null,
  "name": "net/http",
  "type": "framework",
  "support_level": null,
  "body": "foo bar"
}
""".strip()


class SyncDocsTest(TestCase):
    @responses.activate
    @mock.patch('sentry.tasks.sync_docs.sync_integration_docs')
    def test_simple(self, mock_sync_integration_docs):
        responses.add('GET',
                      'https://docs.getsentry.com/hosted/_platforms/_index.json',
                      body=INDEX_JSON)

        sync_docs()

        data = options.get('sentry:docs')
        assert data == {
            'platforms': [
                {
                    'id': 'go',
                    'integrations': [
                        {
                            'id': 'go',
                            'link': 'https://docs.getsentry.com/hosted/clients/go/',
                            'name': 'Go',
                            'type': 'language'
                        },
                        {
                            'id': 'go-http',
                            'link': None,
                            'name': 'net/http',
                            'type': 'framework'
                        }
                    ],
                    'name': 'Go',
                }
            ]
        }

        assert mock_sync_integration_docs.mock_calls == [
            mock.call.delay('go', '_self', 'go.json'),
            mock.call.delay('go', 'http', 'go/http.json'),
        ]


class SyncIntegrationDocsTest(TestCase):
    @responses.activate
    def test_platform(self):
        responses.add('GET',
                      'https://docs.getsentry.com/hosted/_platforms/go.json',
                      body=GO_JSON)

        sync_integration_docs('go', '_self', 'go.json')

        data = options.get('sentry:docs:go')
        assert data == {
            'id': 'go',
            'html': 'foo bar',
            'link': 'https://docs.getsentry.com/hosted/clients/go/',
            'name': 'Go',
        }

    @responses.activate
    def test_integration(self):
        responses.add('GET',
                      'https://docs.getsentry.com/hosted/_platforms/go/http.json',
                      body=GO_HTTP_JSON)

        sync_integration_docs('go', 'http', 'go/http.json')

        data = options.get('sentry:docs:go-http')
        assert data == {
            'id': 'go-http',
            'html': 'foo bar',
            'link': None,
            'name': 'net/http',
        }
