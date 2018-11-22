from __future__ import absolute_import

from sentry.stacktraces import find_stacktraces_in_data, normalize_in_app
from sentry.testutils import TestCase


class FindStacktracesTest(TestCase):
    def test_stacktraces_basics(self):
        data = {
            'message': 'hello',
            'platform': 'javascript',
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
                                    'platform': 'native',
                    },
                ],
            },
        }

        infos = find_stacktraces_in_data(data)
        assert len(infos) == 1
        assert len(infos[0].stacktrace['frames']) == 2
        assert infos[0].platforms == set(['javascript', 'native'])

    def test_stacktraces_exception(self):
        data = {
            'message': 'hello',
            'platform': 'javascript',
            'exception': {
                'values': [
                    {
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
                    }
                ],
            }
        }

        infos = find_stacktraces_in_data(data)
        assert len(infos) == 1
        assert len(infos[0].stacktrace['frames']) == 2

    def test_stacktraces_threads(self):
        data = {
            'message': 'hello',
            'platform': 'javascript',
            'threads': {
                'values': [
                    {
                        'id': '4711',
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
                    }
                ]
            }
        }

        infos = find_stacktraces_in_data(data)
        assert len(infos) == 1
        assert len(infos[0].stacktrace['frames']) == 2

    def test_find_stacktraces_skip_none(self):
        # This tests:
        #  1. exception is None
        #  2. stacktrace is None
        #  3. frames is None
        #  3. frames contains only None
        #  4. frame is None
        data = {
            'message': 'hello',
            'platform': 'javascript',
            'exception': {
                'values': [
                    None,
                    {
                        'type': 'Error',
                        'stacktrace': None,
                    },
                    {
                        'type': 'Error',
                        'stacktrace': {
                            'frames': None,
                        },
                    },
                    {
                        'type': 'Error',
                        'stacktrace': {
                            'frames': [None],
                        },
                    },
                    {
                        'type': 'Error',
                        'stacktrace': {
                            'frames': [
                                None,
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
                    },
                ]
            }
        }

        infos = find_stacktraces_in_data(data)
        assert len(infos) == 1
        # XXX: The null frame is still part of this stack trace!
        assert len(infos[0].stacktrace['frames']) == 3


class NormalizeInApptest(TestCase):
    def test_normalize_with_system_frames(self):
        data = {
            'stacktrace': {
                'frames': [
                    None,
                    {
                        'abs_path': 'http://example.com/foo.js',
                        'filename': 'foo.js',
                        'lineno': 4,
                        'colno': 0,
                        'in_app': True,
                    },
                    {
                        'abs_path': 'http://example.com/foo.js',
                        'filename': 'foo.js',
                        'lineno': 1,
                        'colno': 0,
                    },
                ]
            }
        }

        normalize_in_app(data)
        assert data['stacktrace']['frames'][1]['in_app'] is True
        assert data['stacktrace']['frames'][2]['in_app'] is False

    def test_normalize_skips_none(self):
        data = {
            'stacktrace': {
                'frames': [
                    None,
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
                ]
            }
        }

        normalize_in_app(data)
        assert data['stacktrace']['frames'][1]['in_app'] is False
        assert data['stacktrace']['frames'][2]['in_app'] is False
