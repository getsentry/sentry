# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.constants import MAX_CULPRIT_LENGTH
from sentry.event_manager import generate_culprit, md5_from_hash


def test_with_exception_interface():
    data = {
        'sentry.interfaces.Exception': {
            'values': [
                {
                    'stacktrace': {
                        'frames': [
                            {
                                'lineno': 1,
                                'filename': 'foo.py',
                            }, {
                                'lineno': 1,
                                'filename': 'bar.py',
                                'in_app': True,
                            }
                        ],
                    }
                }
            ]
        },
        'sentry.interfaces.Stacktrace': {
            'frames': [
                {
                    'lineno': 1,
                    'filename': 'NOTME.py',
                }, {
                    'lineno': 1,
                    'filename': 'PLZNOTME.py',
                    'in_app': True,
                }
            ],
        },
        'sentry.interfaces.Http': {
            'url': 'http://example.com'
        },
    }
    assert generate_culprit(data) == 'bar.py in ?'


def test_with_missing_exception_interface():
    data = {
        'sentry.interfaces.Stacktrace': {
            'frames': [
                {
                    'lineno': 1,
                    'filename': 'NOTME.py',
                }, {
                    'lineno': 1,
                    'filename': 'PLZNOTME.py',
                    'in_app': True,
                }
            ],
        },
        'sentry.interfaces.Http': {
            'url': 'http://example.com'
        },
    }
    assert generate_culprit(data) == 'PLZNOTME.py in ?'


def test_with_empty_stacktrace():
    data = {
        'sentry.interfaces.Stacktrace': None,
        'sentry.interfaces.Http': {
            'url': 'http://example.com'
        },
    }
    assert generate_culprit(data) == 'http://example.com'


def test_with_only_http_interface():
    data = {
        'sentry.interfaces.Http': {
            'url': 'http://example.com'
        },
    }
    assert generate_culprit(data) == 'http://example.com'

    data = {
        'sentry.interfaces.Http': {},
    }
    assert generate_culprit(data) == ''


def test_empty_data():
    assert generate_culprit({}) == ''


def test_truncation():
    data = {
        'sentry.interfaces.Exception': {
            'values':
            [{
                'stacktrace': {
                    'frames': [{
                        'filename': 'x' * (MAX_CULPRIT_LENGTH + 1),
                    }],
                }
            }],
        }
    }
    assert len(generate_culprit(data)) == MAX_CULPRIT_LENGTH

    data = {
        'sentry.interfaces.Stacktrace': {
            'frames': [{
                'filename': 'x' * (MAX_CULPRIT_LENGTH + 1),
            }]
        }
    }
    assert len(generate_culprit(data)) == MAX_CULPRIT_LENGTH

    data = {
        'sentry.interfaces.Http': {
            'url': 'x' * (MAX_CULPRIT_LENGTH + 1),
        }
    }
    assert len(generate_culprit(data)) == MAX_CULPRIT_LENGTH


def test_md5_from_hash():
    result = md5_from_hash(['foo', 'bar', u'foô'])
    assert result == '6d81588029ed4190110b2779ba952a00'
