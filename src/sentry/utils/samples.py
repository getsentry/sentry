"""
sentry.utils.samples
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import os.path

from sentry.constants import DATA_ROOT, PLATFORM_ROOTS, PLATFORM_TITLES
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

    data['platform'] = platform
    data['message'] = 'This is an example %s exception' % (
        PLATFORM_TITLES.get(platform, platform.title()),)
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
    }
    data['sentry.interfaces.Http'] = {
        "cookies": {},
        "url": "http://example.com/foo",
        "headers": {
            "Referer": "http://example.com",
            "User-Agent": "Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.72 Safari/537.36"
        },
        "env": {},
        "query_string": "",
        "data": {},
        "method": "GET"
    }

    return data


def create_sample_event(project, platform=None, default=None):
    if not platform:
        platform = project.platform

    if not platform and not default:
        return

    platform = PLATFORM_ROOTS.get(platform, platform)

    data = load_data(platform, default)

    if not data:
        return

    manager = EventManager(data)
    manager.normalize()
    return manager.save(project.id, raw=True)
