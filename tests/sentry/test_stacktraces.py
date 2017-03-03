from __future__ import absolute_import

from sentry.stacktraces import find_stacktraces_in_data


def test_stacktraces_basics():
    data = {
        'message': 'hello',
        'platform': 'javascript',
        'sentry.interfaces.Stacktrace': {
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
    }

    infos = find_stacktraces_in_data(data)
    assert len(infos) == 1
    assert len(infos[0].stacktrace['frames']) == 2
    assert infos[0].platforms == set(['javascript'])


def test_get_stacktraces_returns_exception_interface():
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

    infos = find_stacktraces_in_data(data)
    assert len(infos) == 1
    assert len(infos[0].stacktrace['frames']) == 2
