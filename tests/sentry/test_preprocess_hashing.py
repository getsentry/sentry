# -*- coding: utf-8 -*-

from __future__ import absolute_import, print_function

import logging

from sentry.event_manager import get_preprocess_defaults, get_preprocess_hashes
from sentry.testutils import TestCase


class PreProcessingHashTest(TestCase):
    def make_event_data(self, **kwargs):
        data = kwargs.pop('data', {})
        result = {
            'event_id': 'a' * 32,
            'message': 'foo',
            'timestamp': 1403007314.570599,
            'level': logging.ERROR,
            'logger': 'default',
            'tags': [],
        }
        result.update(kwargs)
        result.update(data)
        return result

    def test_similar_message_prefix_doesnt_match(self):
        event_data1 = self.make_event_data(message='foo bar')
        hashes1 = get_preprocess_hashes(event_data1)

        event_data2 = self.make_event_data(message='foo baz')
        hashes2 = get_preprocess_hashes(event_data2)

        assert hashes1 != hashes2

    def test_matches_with_fingerprint(self):
        event_data1 = self.make_event_data(
            message='foo',
            event_id='a' * 32,
            fingerprint=['a' * 32],
        )
        event_data2 = self.make_event_data(
            message='foo bar',
            event_id='b' * 32,
            fingerprint=['a' * 32],
        )
        hashes1 = get_preprocess_hashes(event_data1)
        hashes2 = get_preprocess_hashes(event_data2)
        assert hashes1 == hashes2

    def test_differentiates_with_fingerprint(self):
        event_data1 = self.make_event_data(
            message='foo',
            event_id='a' * 32,
            fingerprint=['{{ default }}', 'a' * 32],
        )
        event_data2 = self.make_event_data(
            message='foo bar',
            event_id='b' * 32,
            fingerprint=['a' * 32],
        )
        hashes1 = get_preprocess_hashes(event_data1)
        hashes2 = get_preprocess_hashes(event_data2)
        assert hashes1 != hashes2

    def test_stacktrace_wins_over_template(self):
        event_data = self.make_event_data(
            data={
                'sentry.interfaces.Stacktrace': {
                    'frames': [{
                        'lineno': 1,
                        'filename': 'foo.py',
                    }],
                },
                'sentry.interfaces.Template': {
                    'abs_path': '/real/file/name.html',
                    'filename': 'file/name.html',
                    'pre_context': ['line1', 'line2'],
                    'context_line': 'line3',
                    'lineno': 3,
                    'post_context': ['line4', 'line5'],
                }
            },
            platform='python',
            message='Foo bar',
        )
        hashes = get_preprocess_defaults(event_data)
        assert len(hashes) == 1
        assert hashes == [['foo.py']]

    def test_default_value(self):
        data = {
            'sentry.interfaces.Stacktrace': {
                'frames': [
                    {
                        'lineno': 1,
                        'filename': 'foo.py',
                    }, {
                        'lineno': 1,
                        'filename': 'foo.py',
                        'in_app': True,
                    }
                ],
            },
            'sentry.interfaces.Http': {
                'url': 'http://example.com'
            },
        }
        event_data1 = self.make_event_data(
            data=data,
            fingerprint=["{{default}}"],
            platform='python',
            message='Foo bar',
        )
        event_data2 = self.make_event_data(
            data=data,
            platform='python',
            message='Foo bar',
        )
        fp_checksums = get_preprocess_hashes(event_data1)
        def_checksums = get_preprocess_hashes(event_data2)
        assert def_checksums == fp_checksums

    def test_custom_values(self):
        data = {
            'sentry.interfaces.Stacktrace': {
                'frames': [
                    {
                        'lineno': 1,
                        'filename': 'foo.py',
                    }, {
                        'lineno': 1,
                        'filename': 'foo.py',
                        'in_app': True,
                    }
                ],
            },
            'sentry.interfaces.Http': {
                'url': 'http://example.com'
            },
        }
        event_data1 = self.make_event_data(
            data=data,
            platform='python',
            message='Foo bar',
        )
        event_data2 = self.make_event_data(
            data=data,
            platform='python',
            message='Foo bar',
            fingerprint=["{{default}}", "custom"],
        )
        fp_checksums = get_preprocess_hashes(event_data1)
        def_checksums = get_preprocess_hashes(event_data2)
        assert len(fp_checksums) == len(def_checksums)
        assert def_checksums != fp_checksums

    def test_exception_with_stacktrace(self):
        data = {
            'sentry.interfaces.Exception': {
                'exc_omitted':
                None,
                'values': [
                    {
                        'mechanism': None,
                        'module': None,
                        'raw_stacktrace': None,
                        'stacktrace': {
                            'frames': [
                                {
                                    'abs_path':
                                    u'http://localhost:8000/_static/373562702009df1692da6eb80a933139f29e094b/sentry/dist/vendor.js',
                                    'colno':
                                    22,
                                    'filename':
                                    u'/_static/373562702009df1692da6eb80a933139f29e094b/sentry/dist/vendor.js',
                                    'function':
                                    u'Object.receiveComponent',
                                    'in_app':
                                    True,
                                    'lineno':
                                    17866
                                }, {
                                    'abs_path':
                                    u'http://localhost:8000/_static/373562702009df1692da6eb80a933139f29e094b/sentry/dist/vendor.js',
                                    'colno':
                                    10,
                                    'filename':
                                    u'/_static/373562702009df1692da6eb80a933139f29e094b/sentry/dist/vendor.js',
                                    'function':
                                    u'ReactCompositeComponentWrapper.receiveComponent',
                                    'in_app':
                                    True,
                                    'lineno':
                                    74002
                                }, {
                                    'abs_path':
                                    u'http://localhost:8000/_static/373562702009df1692da6eb80a933139f29e094b/sentry/dist/app.js',
                                    'colno':
                                    9,
                                    'filename':
                                    u'/_static/373562702009df1692da6eb80a933139f29e094b/sentry/dist/app.js',
                                    'function':
                                    u'Constructor.render',
                                    'in_app':
                                    True,
                                    'lineno':
                                    47628
                                }
                            ],
                            'frames_omitted':
                            None,
                            'registers':
                            None
                        },
                        'thread_id': None,
                        'type': u'TypeError',
                        'value': u"Cannot set property 'b' of null"
                    }
                ]
            }
        }

        event_data = self.make_event_data(
            data=data,
            platform='javascript',
        )

        assert get_preprocess_defaults(event_data) == [
            [
                u'/_static/<version>/sentry/dist/vendor.js',
                u'Object.receiveComponent',
                u'/_static/<version>/sentry/dist/vendor.js',
                u'ReactCompositeComponentWrapper.receiveComponent',
                u'/_static/<version>/sentry/dist/app.js',
                u'Constructor.render',
                u'TypeError',
            ]
        ]
