from __future__ import absolute_import

from mock import patch

from sentry.models import Event
from sentry.testutils import TestCase


class JavascriptIntegrationTest(TestCase):
    @patch('sentry.lang.javascript.processor.fetch_url')
    def test_source_expansion(self, mock_fetch_url):
        data = {
            'message': 'hello',
            'platform': 'javascript',
            'sentry.interfaces.Exception': {
                'values': [{
                    'type': 'Error',
                    'stacktrace': {
                        'frames': [
                            {
                                'abs_path': 'http://example.com/foo.js',
                                'filename': 'foo.js',
                                'lineno': 4,
                                'colno': 0,
                            },
                            {
                                'abs_path': 'http://example.com/foo.js',
                                'filename': 'foo.js',
                                'lineno': 1,
                                'colno': 0,
                            },
                        ],
                    },
                }],
            }
        }

        mock_fetch_url.return_value.body = '\n'.join('hello world')

        resp = self._postWithHeader(data)
        assert resp.status_code, 200

        mock_fetch_url.assert_called_once_with(
            'http://example.com/foo.js', project=self.project)

        event = Event.objects.get()
        exception = event.interfaces['sentry.interfaces.Exception']
        frame_list = exception.values[0].stacktrace.frames

        frame = frame_list[0]
        assert frame.pre_context == ['h', 'e', 'l']
        assert frame.context_line == 'l'
        assert frame.post_context == ['o', ' ', 'w', 'o', 'r']

        frame = frame_list[1]
        assert frame.pre_context is None
        assert frame.context_line == 'h'
        assert frame.post_context == ['e', 'l', 'l', 'o', ' ']
