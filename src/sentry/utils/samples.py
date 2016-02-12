"""
sentry.utils.samples
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import os.path

from sentry.constants import DATA_ROOT
from sentry.event_manager import EventManager
from sentry.utils import json


def load_data(platform, default=None):
    data = None
    for platform in (platform, default):
        if platform is None:
            continue

        json_path = os.path.join(DATA_ROOT, 'samples', '%s.json' % (platform.encode('utf-8'),))

        if not os.path.exists(json_path):
            continue

        with open(json_path) as fp:
            data = json.loads(fp.read())
            break

    if data is None:
        return

    if platform == 'csp':
        return data

    data['platform'] = platform
    data['message'] = 'This is an example %s exception' % (platform,)
    data['sentry.interfaces.User'] = {
        "username": "getsentry",
        "id": "1671",
        "email": "foo@example.com"
    }
    data['extra'] = {
        'session': {
            'foo': 'bar',
        },
        'results': [1, 2, 3, 4, 5],
        'emptyList': [],
        'emptyMap': {},
        'length': 10837790,
        'unauthorized': False,
        'url': 'http://example.org/foo/bar/',
    }
    data['modules'] = {
        'my.package': '1.0.0',
    }
    data['sentry.interfaces.Http'] = {
        "cookies": 'foo=bar;biz=baz',
        "url": "http://example.com/foo",
        "headers": {
            "Referer": "http://example.com",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.72 Safari/537.36"
        },
        "env": {
            'ENV': 'prod',
        },
        "query_string": "foo=bar",
        "data": '{"hello": "world"}',
        "method": "GET"
    }

    return data


def create_sample_event(project, platform=None, default=None, raw=True,
                        **kwargs):
    if not platform and not default:
        return

    if platform:
        platform = platform.split('-', 1)[0].split('_', 1)[0]

    data = load_data(platform, default)

    if not data:
        return

    data.update(kwargs)

    manager = EventManager(data)
    manager.normalize()
    return manager.save(project.id, raw=raw)
